# Step 2: upload-flow-simplification

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/PRD.md`, `/docs/ADR.md`(ADR-011) — 계좌 개념 제거, Free/Pro는 이제 히스토리 기간으로만 구분되고 업로드 시점의 "계좌 개수" 게이팅이 없다는 점
- 이전 step들의 산출물 요약(`phases/remove-accounts/index.json`) — step 0에서 바뀐 `create_statement_upload`/`finalize_statement` RPC 시그니처, step 1에서 추가된 `detectedLabel`
- `src/types/domain.ts` — `ApiErrorCode`(6행 부근 `upgrade_required` 포함), `InitStatementUploadResponse`(38행~, `accountId` 필드), `CompleteUploadResponse`(46행~), `StatementStatusResponse`(51행~, `accountId` 필드)
- `src/services/statementUploadService.ts` — `initStatementUpload`가 `accountId`/`newAccountLabel`을 받아 `create_statement_upload` RPC에 `p_account_id`/`p_new_account_label`로 넘기는 부분(148~155행 부근), 응답 매핑(174행, 401행의 `accountId: created.account_id`/`accountId: statement.account_id`), `upgrade_required` 관련 로직 전체
- `src/app/api/statements/init-upload/route.ts` — `initUploadSchema`의 `accountId`/`newAccountLabel` 필드와 "정확히 하나만 선택" refine 규칙(12~22행)
- `src/components/dashboard/statement-upload-manager.tsx` — `accounts`/`initialAccounts` prop, `selectedAccountId`/`newAccountLabel`/`activeAccount` state, `chooseAccount`/`chooseNewAccount` 함수, 계좌 칩 UI(532~562행 부근), "신규 계좌 이름" input(564~579행 부근), `upgradeOpen` 다이얼로그(772~799행 부근)와 그걸 여는 모든 지점(`chooseAccount`/`chooseNewAccount`의 Free 분기, `startUpload`의 `upgrade_required` 처리)
- `src/app/(dashboard)/uploads/page.tsx` — `accountsResult` 쿼리, `initialAccounts` prop 전달
- `src/app/api/statements/init-upload/route.test.ts`, `src/services/statementUploadService.test.ts`, `src/components/dashboard/statement-upload-manager.test.tsx`, `src/test/integration-verification.integration.test.ts` — `upgrade_required`/`accountId`/`newAccountLabel`을 다루는 기존 테스트 케이스들(이번 step에서 이 케이스들을 새 설계에 맞게 고치거나 제거해야 한다)

## 작업

업로드 흐름에서 계좌 선택/생성 단계를 완전히 없앤다. Free/Pro는 이제 업로드 시점에 아무것도 게이팅하지 않는다(히스토리 열람 제한만 남는다 — `has_locked_history()`는 이미 계좌와 무관하므로 변경 불필요).

1. **`src/types/domain.ts`**: `ApiErrorCode`에서 `"upgrade_required"`를 제거한다(더 이상 어떤 경로도 이 코드를 던지지 않는다). `InitStatementUploadResponse`/`StatementStatusResponse`에서 `accountId` 필드를 제거하고, 대신 `StatementStatusResponse`에 `detectedLabel: string | null`을 추가한다(step 1에서 만든 컬럼을 클라이언트에 노출).
2. **`statementUploadService.ts`**: `initStatementUpload`의 입력 타입에서 `accountId`/`newAccountLabel`을 제거하고, `create_statement_upload` RPC 호출을 새 시그니처(`p_user_id, p_file_name, p_declared_size`)에 맞춘다. 응답 매핑에서 `accountId` 관련 필드를 제거하고, statement 상태 조회 응답에 `detected_label` → `detectedLabel`을 매핑해 넣는다. `upgrade_required` 관련 분기가 있다면 제거한다.
3. **`api/statements/init-upload/route.ts`**: `initUploadSchema`에서 `accountId`/`newAccountLabel` 필드와 그 `.refine()` 규칙을 제거한다. 남는 필드는 `fileName`, `declaredSizeBytes`뿐이다.
4. **`statement-upload-manager.tsx`**: 아래를 전부 제거한다.
   - `accounts`/`initialAccounts` prop과 `UploadAccount` 타입, `activeAccount`, `selectedAccountId`, `newAccountLabel`, `chooseAccount`, `chooseNewAccount`, `newAccountInputRef`
   - 계좌 칩 UI 블록, "신규 계좌 이름" input 블록
   - `upgradeOpen` state와 그 `<Dialog>`, 그리고 `startUpload()` 안의 `upgrade_required` 처리 분기
   - `startUpload()` 맨 앞의 "계좌를 선택하거나 신규 계좌 이름을 입력해주세요" 검증도 제거(더 이상 계좌 개념이 없으므로 검증 대상 자체가 없다)
   - `init-upload` 호출 body에서 `accountId`/`newAccountLabel` 관련 필드를 뺀다
   - 명세서 목록 행(`StatementRow`)에 `statement.detectedLabel`이 있으면 파일명 옆에 작은 배지/텍스트로 보여준다(디자인은 `finsight-design-system` 스킬의 뱃지/텍스트 톤 규칙을 따른다 — 새 색을 추가하지 말 것)
5. **`uploads/page.tsx`**: `accountsResult` 쿼리와 `initialAccounts` prop 전달을 제거한다.
6. **테스트 정리**: `upgrade_required`/`accountId`/`newAccountLabel`을 다루던 기존 테스트 케이스를 새 설계에 맞게 고치거나(계좌 관련 부분만 들어냄) 완전히 무의미해진 케이스는 삭제한다. `src/test/integration-verification.integration.test.ts`의 "Free 계좌 생성 동시성" 관련 테스트는 이제 테스트 대상 자체(Free 1계좌 제한)가 사라졌으므로 삭제하거나, 남길 가치가 있는 다른 동시성 검증(예: 일 10회 rate limit 동시성)으로 대체할지 판단해 처리한다.

## Acceptance Criteria

**중요**: `npm run build`는 이 step 이후에도 실패한 상태가 정상이다 — 대시보드(`dashboard/page.tsx`, `dashboard-insights.tsx`)가 아직 옛 `accounts` 쿼리/prop을 참조 중이며, 그건 step 3이 고친다(전체 그린 빌드는 step 3 완료 후 성립). `npm run build`를 통과시키려고 대시보드 파일을 건드리지 마라. `npm test`는 vitest가 타입 체크 없이 트랜스파일만 하므로 이 step에서도 정상적으로 통과해야 한다.

```bash
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - PRD/ADR-011대로 업로드 시점에 계좌 관련 입력·게이팅이 전혀 남아있지 않은가?
   - CLAUDE.md CRITICAL 규칙("accounts/uploaded_statements/transactions 쓰기는 RPC로만") 위반 없는가?
3. `phases/remove-accounts/index.json`의 step 2를 업데이트한다.

## 금지사항

- `has_locked_history()` RPC나 그걸 쓰는 대시보드 잠금 배너 로직은 이번 step과 무관하니 건드리지 마라(계좌와 무관한 히스토리 제한이라 그대로 유지).
- 대시보드(`dashboard/page.tsx`, `dashboard-insights.tsx`)의 계좌 관련 코드는 이번 step에서 건드리지 마라 — step 3의 범위다. (단, `statement-upload-manager.tsx`가 대시보드 컴포넌트를 import하고 있지는 않으므로 충돌은 없을 것이다.)
- `create_statement_upload`/`finalize_statement` RPC 정의 자체(마이그레이션 SQL)는 이미 step 0에서 끝났다 — 다시 손대지 마라.
- **`npm run build`를 통과시키겠다고 대시보드 등 이 step 범위 밖의 파일을 고치지 마라.**
- 드래그 앤 드롭, `pending-upload-context`(대시보드 빈 화면 드롭 → 업로드 페이지 전달) 로직은 계좌와 무관하므로 그대로 유지하고 불필요하게 리팩터링하지 마라.
- 기존 테스트를 이유 없이 삭제하지 마라 — 계좌 관련이라 더 이상 성립하지 않는 케이스만 정리한다.
