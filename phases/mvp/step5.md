# Step 5: statement-upload

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (CSV 업로드 데이터 흐름 1~5단계)
- `/docs/ADR.md` (ADR-004, ADR-005, ADR-008)
- step 1의 `uploaded_statements`/`accounts`/`upload_usage` 스키마와 `create_statement_upload` RPC, step 3의 `(dashboard)` 셸
- `.claude/skills/finsight-design-system/references/prototype/dashboard-screens.jsx`의 `UploadModal()`, `Statements()`, `StatementRow()`, `StatusBadge()`, `ConfirmDelete()`, `AccountChips()` (업로드/목록 UI 레이아웃 참조 — `finsight-design-system` 스킬 참고)

**범위 경계**: 이 step은 업로드 접수·검증까지만 다룬다. Claude 기반 실제 분석(column mapping, category 분류)과 `after()` 백그라운드 트리거, `retry` 라우트는 **step 6의 범위**다 — 이 step에서 만들지 마라.

## 작업

### 1. `lib/csv/decode.ts` (테스트 대상 — tdd-guard 예외 아님)

```typescript
export function decodeCsvBuffer(buf: Buffer): { text: string; encoding: 'utf-8' | 'cp949' } {
  // 1) UTF-8 BOM(EF BB BF) 있으면 utf-8로 확정 후 BOM 제거
  // 2) new TextDecoder('utf-8', { fatal: true }).decode(buf) 시도
  // 3) 실패하면 iconv-lite로 cp949 디코딩
  // 4) 둘 다 실패하면 예외를 던진다(호출부가 failure_code='encoding_error'로 매핑)
}
```

### 2. `lib/csv/parse.ts` (테스트 대상)

RFC 4180 호환 파서(quoted field 안의 개행/쉼표 포함 처리). `parseCsv(text: string): { headers: string[]; rows: string[][] }`를 export한다. 헤더 행 1개 + data row로 나누고, NUL 바이트가 있거나 컬럼 수가 행마다 안 맞으면 예외를 던진다. `rows.length`가 실제 data row 수다(2,000행 상한 검증은 호출부에서 이 값으로 한다).

### 3. `create_statement_upload` RPC 호출 래퍼

`services/statementUploadService.ts`에 `deps: { supabase }`를 주입받는 함수들을 만든다(직접 `createServerClient()` 호출 금지).

- `initStatementUpload(userId, input, deps)`: `create_statement_upload` RPC를 service-role 클라이언트로 호출한다. RPC가 던지는 `rate_limited`/`upgrade_required`/`account_not_found`/`profile_not_found` 예외를 잡아 `ApiErrorCode`(`rate_limited`/`upgrade_required`/`not_found`/`internal_error`)로 매핑한다. 성공하면 `supabase.storage.from('statements').createSignedUploadUrl(storagePath)`로 signed upload token을 발급해 `{ statementId, accountId, storagePath, uploadToken, status: 'uploading' }`를 반환한다.
- `reissueUploadUrl(userId, statementId, deps)`: statement가 요청자 소유이고 `status==='uploading'`인지 확인한 뒤(아니면 `conflict`), **새 usage/account/statement를 만들지 않고** 같은 `storage_path`에 대해 signed upload token만 재발급한다. 네트워크 실패로 업로드가 끊겼을 때 quota를 다시 차감하지 않기 위한 경로다.
- `getOwnedStatement(userId, statementId, deps)`: 소유권 확인 헬퍼 — 여러 route에서 재사용한다.

### 4. `POST /api/statements/init-upload`

`requireUserId()` → body(`accountId?`, `newAccountLabel?`, `fileName`, `declaredSizeBytes`) 파싱 → `initStatementUpload` 호출 → `201 InitStatementUploadResponse`.

### 5. `POST /api/statements/{id}/upload-url`

`requireUserId()` → `reissueUploadUrl` → `200 { uploadToken }`. 존재하지 않거나 소유자가 아니면 `404 not_found`, `uploading` 상태가 아니면 `409 conflict`.

### 6. `POST /api/statements/{id}/complete-upload` — **멱등, Claude 호출 없음**

```typescript
export const maxDuration = 60; // 이 route는 다운로드+검증만 한다. Claude 호출/후처리는 step 6에서 다른 진입점으로 붙는다.

export async function POST(req: NextRequest, { params }) {
  const userId = await requireUserId();
  const statement = await getOwnedStatement(userId, params.id, deps);
  if (!statement) return apiError('not_found', ...);

  if (statement.status !== 'uploading') {
    // 멱등: 이미 검증됐거나 처리 중/완료/실패한 요청이면 현재 상태를 그대로 반환
    return NextResponse.json<CompleteUploadResponse>({ statementId: statement.id, status: statement.status }, { status: 202 });
  }

  const { data: fileData, error: downloadError } = await deps.supabase.storage
    .from('statements').download(statement.storagePath);
  if (downloadError || !fileData) {
    await markValidationFailed(statement.id, 'upload_missing', deps);
    return apiError('validation_error', '업로드된 파일을 찾을 수 없습니다.', 422);
  }

  const buf = Buffer.from(await fileData.arrayBuffer());
  if (buf.byteLength > 5_242_880) {
    await markValidationFailed(statement.id, 'file_too_large', deps, { removeStorage: true });
    return apiError('validation_error', '파일이 5MB를 초과합니다.', 422);
  }

  let text: string;
  try {
    ({ text } = decodeCsvBuffer(buf));
  } catch {
    await markValidationFailed(statement.id, 'encoding_error', deps, { removeStorage: true });
    return apiError('validation_error', '인코딩 또는 CSV 형식을 인식할 수 없습니다.', 422);
  }

  let rowCount: number;
  try {
    rowCount = parseCsv(text).rows.length;
  } catch {
    await markValidationFailed(statement.id, 'invalid_csv', deps, { removeStorage: true });
    return apiError('validation_error', 'CSV 구조를 읽을 수 없습니다.', 422);
  }
  if (rowCount < 1 || rowCount > 2000) {
    await markValidationFailed(statement.id, 'invalid_csv', deps, { removeStorage: true });
    return apiError('validation_error', '최대 2,000행까지 지원합니다. 기간을 나눠 다시 업로드해주세요.', 422);
  }

  await deps.supabase.from('uploaded_statements').update({
    status: 'pending', file_size_bytes: buf.byteLength, row_count: rowCount, updated_at: new Date().toISOString(),
  }).eq('id', statement.id);

  return NextResponse.json<CompleteUploadResponse>({ statementId: statement.id, status: 'pending' }, { status: 202 });
  // 주의: 이 함수는 백그라운드 처리를 트리거하지 않는다 — step 6이 이 route에 after() 호출을 추가한다.
}
```

`markValidationFailed(statementId, failureCode, deps, { removeStorage })`는 `ERROR_MESSAGES[failureCode]` 화이트리스트로 `error_message`를 채우고 `status='failed'`로 갱신한다. `removeStorage`가 true면 `storage.from('statements').remove([path])`도 호출한다(실패해도 무시 — DB 상태 갱신이 우선).

### 7. `GET /api/statements/{id}` / `DELETE /api/statements/{id}`

- GET: 소유자의 `StatementStatusResponse`(`retryable`은 이 step에서는 항상 `false` — lease 개념이 아직 없다. step 6에서 의미가 생긴다)를 반환한다.
- DELETE: **Storage 삭제 → DB 삭제** 순서로 진행하고, Storage 객체가 이미 없어도(404) 성공으로 간주해 계속 진행한다(재호출 가능하게). `uploaded_statements` row를 delete하면 `transactions`는 `on delete cascade`로 함께 삭제된다. `upload_usage`는 건드리지 않는다(FK가 `on delete set null`이라 자동으로 유지됨).

### 8. 업로드 UI (디자인은 `finsight-design-system` 스킬 참고)

`src/app/(dashboard)/uploads/page.tsx`: `dashboard-screens.jsx`의 `AccountChips()`(계좌 선택, Free는 잠긴 계좌에 🔒)로 계좌를 고르거나 신규 계좌 라벨을 입력하고, `UploadModal()`의 select→uploading(진행률바)→pending→processing→completed/failed 상태 전이와 `ConsentCheckbox`(Supabase/Anthropic 전달 동의) 패턴을 그대로 따른다. 흐름: `POST init-upload` → 받은 `uploadToken`으로 `supabase.storage.from('statements').uploadToSignedUrl(storagePath, uploadToken, file)` 직접 업로드 → 성공하면 `POST {id}/complete-upload` → 실패(네트워크 등)하면 `POST {id}/upload-url`로 토큰 재발급 후 재시도. `403 upgrade_required` 응답은 업그레이드 모달로, `429 rate_limited`는 제한 안내로 연결한다. statement 목록은 `Statements()`/`StatementRow()`/`StatusBadge()`/`ConfirmDelete()`(삭제는 별도 다이얼로그가 아니라 행 안에서 "삭제할까요? 삭제/취소"로 인라인 확인) 패턴을 따른다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm test
```

## 검증 절차

1. 위 AC를 실행한다.
2. `decodeCsvBuffer`/`parseCsv`에 대해 UTF-8, BOM 포함 UTF-8, CP949, 깨진 인코딩, quoted-newline 포함 CSV, NUL 바이트 포함, 2,001행 fixture로 테스트한다.
3. `complete-upload`를 같은 statement에 두 번 호출했을 때(멱등) 두 번째 호출이 재검증 없이 같은 상태를 반환하는지 테스트한다.
4. `upload-url` 재발급이 `upload_usage`/`accounts` row를 추가로 만들지 않는지 확인한다.
5. `DELETE`가 Storage 객체가 이미 없는 상태에서도 성공하는지(재호출 가능성) 테스트한다.
6. 결과에 따라 `phases/mvp/index.json`의 step 5 항목을 업데이트한다.

## 금지사항

- `create_statement_upload` RPC를 거치지 않고 `accounts`/`uploaded_statements`/`upload_usage`에 직접 INSERT하지 마라 — 이유: quota 검사와 소유권 보장이 RPC 트랜잭션 밖에서는 원자적이지 않다.
- `storage_path`를 만들 때 원본 `file_name`을 쓰지 마라 — RPC가 이미 `{user_id}/{statement_id}`로 생성해 반환한다.
- 클라이언트가 보낸 `declared_size`/파일 크기/행 수를 최종 검증으로 신뢰하지 마라 — `complete-upload`가 Storage 원본을 다시 읽어 확정하는 값만 신뢰한다.
- `after()`, Claude 호출, `retry` 라우트를 이 step에서 구현하지 마라 — step 6의 범위다.
- 에러 메시지에 raw exception이나 CSV 내용을 담지 마라 — `ERROR_MESSAGES[failure_code]` 화이트리스트만 사용한다.
- 기존 테스트를 깨뜨리지 마라.
