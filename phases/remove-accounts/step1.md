# Step 1: statement-label-detection

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-003(Claude는 컬럼 매핑·카테고리 분류로만 제한, 새 호출을 추가하지 않고 기존 호출의 응답 스키마만 확장), ADR-011(계좌 제거, 은행/카드명은 표시용 라벨)
- 이전 step에서 적용한 마이그레이션(`phases/remove-accounts/index.json`의 step 0 summary 참고) — `uploaded_statements.detected_label` 컬럼과 `finalize_statement(p_user_id, p_statement_id, p_transactions, p_detected_label)`의 새 시그니처를 확인하라(정확한 컬럼/파라미터명은 `src/types/supabase.ts`와 실제 마이그레이션 파일에서 확인)
- `src/lib/pdf/parse.ts` — `parsePdf()`가 헤더 행을 찾기 전(120행 `headerLineIndex`) 라인들을 지금은 버리고 있다. `groupIntoLines`/`lineToSegments`가 만드는 `Line`/`Segment` 구조를 이해하라
- `src/lib/pdf/parse.test.ts` — 기존 PDF 파싱 테스트 패턴(픽스처는 `src/test/pdf-fixture.ts`의 `buildTestPdf` 사용)
- `src/services/statementParserService.ts` — 특히 `ColumnMappingSchema`(24~37행), `inferColumnMapping()`(435~466행, `buildMappingPrompt` 호출부도 확인), `acquireProcessingLease()`(619행~, `Lease` 타입은 88~92행), `parseStatement()`의 706~730행(다운로드 → 파싱 → `inferColumnMapping` 호출)과 751~758행(`finalize_statement` RPC 호출부)
- `src/services/statementParserService.test.ts` — `inferColumnMapping`/`parseStatement` 관련 기존 테스트의 모킹 패턴(Anthropic 클라이언트 모킹 방식)

## 작업

Claude 호출을 새로 추가하지 않고, 기존 컬럼 매핑 추론 1회 호출에 은행/카드명 감지를 얹는다.

1. **`src/lib/pdf/parse.ts`**: `ParsedPdf` 타입에 `preambleLines: string[]`를 추가한다. `parsePdf()`가 `headerLineIndex`를 찾을 때, 그 이전의 각 라인을 세그먼트 텍스트를 공백으로 이어붙인 문자열로 만들어 `preambleLines`에 담아 반환한다(빈 배열일 수 있다 — 헤더가 첫 줄이면 preamble 없음).
2. **`ColumnMappingSchema`**(`statementParserService.ts`)에 `detectedLabel: z.string().nullable()` 필드를 추가한다. "이 파일이 어느 은행/카드사 것인지 알 수 없으면 null"이라는 규칙을 스키마 옆 주석 정도로만 남겨라(zod validation 자체는 nullable이면 충분).
3. **`inferColumnMapping()`** 시그니처를 확장해 은행/카드명 추론에 필요한 컨텍스트(파일명, PDF preamble — CSV는 preamble 없음)를 받게 한다. 컬럼 매핑 프롬프트를 만드는 `buildMappingPrompt`에 이 컨텍스트를 반영하고, "헤더/파일명/(있다면) preamble 텍스트를 보고 은행 또는 카드사 이름을 짧게 추정하라. 근거가 없으면 null을 반환하라"는 지시를 추가한다.
4. **`acquireProcessingLease()`**: `Lease` 타입에 `fileName: string`을 추가하고, 두 곳의 select 컬럼 목록(629행, 663행 부근)에 `file_name`을 포함시켜 반환하도록 고친다.
5. **`parseStatement()`**: `inferColumnMapping` 호출에 `lease.fileName`과(PDF인 경우) `parsePdf`가 반환한 `preambleLines`를 전달한다. `finalize_statement` RPC 호출(751~758행)에 `p_detected_label: mapping.detectedLabel`을 추가한다.
6. CSV 경로(`parseCsv`)는 애초에 표 이전의 "preamble"이라는 개념이 없다(첫 줄을 항상 헤더로 본다) — CSV는 파일명만 근거로 쓰고, `parseCsv`/`decodeCsvBuffer` 자체는 건드리지 않는다.

## Acceptance Criteria

**중요**: `npm run build`는 이 step 이후에도 실패한 상태가 정상이다(대시보드/업로드 UI 등 다른 파일들이 아직 옛 `accounts` 스키마를 참조 중이며, 그건 step 2~3이 고친다 — 전체 그린 빌드는 step 3 완료 후에 성립한다). `npm run build`를 통과시키려고 이 step 범위 밖의 파일을 고치지 마라. `npm test`는 vitest가 타입 체크 없이 트랜스파일만 하므로(`vitest.config.ts`에 typecheck 미설정) 이 step에서도 정상적으로 통과해야 한다.

```bash
npm test
```

`src/lib/pdf/parse.test.ts`에 헤더 위에 은행명 같은 preamble 줄이 있는 PDF를 `buildTestPdf`로 만들어 `preambleLines`에 그 줄이 담기는 테스트를 추가하라. `statementParserService.test.ts`에는 `inferColumnMapping`이 새 컨텍스트 인자를 받아 프롬프트에 반영하는지, `parseStatement`가 `finalize_statement` 호출에 `p_detected_label`을 넘기는지 검증하는 테스트를 추가하라(Anthropic 응답 모킹에 `detectedLabel` 필드를 포함시키면 된다).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - CLAUDE.md CRITICAL 규칙("Claude에 CSV 전체를 한 번에 넘기지 않는다... 컬럼 매핑은 헤더+샘플 행(최대 20행)만")을 벗어나지 않았는가? preamble/파일명을 추가로 보내는 것도 짧은 텍스트이므로 위반이 아니지만, 샘플 행 수(20행)는 늘리지 마라.
   - ADR-003(Claude 호출 횟수 최소화)대로 새 Claude 호출을 추가하지 않고 기존 호출에 필드만 얹었는가?
3. `phases/remove-accounts/index.json`의 step 1을 업데이트한다(completed/error/blocked).

## 금지사항

- 은행/카드명 감지를 위한 새로운 Claude API 호출을 추가하지 마라. 이유: ADR-003이 Claude 호출 범위를 컬럼 매핑·카테고리 분류로 제한한 이유(비용, 프롬프트 인젝션 노출면)가 그대로 적용된다 — 기존 컬럼 매핑 호출의 출력 스키마만 넓혀라.
- `applyColumnMapping`, `classifyCategories`, `assertReconciliation` 등 카테고리 분류/정합성 검증 로직은 이번 step과 무관하니 건드리지 마라.
- 업로드 플로우(`statementUploadService.ts`, `init-upload` route, `statement-upload-manager.tsx`)는 이번 step 범위가 아니다 — step 2에서 다룬다.
- 대시보드(`dashboard/page.tsx`, `dashboard-insights.tsx`)는 step 3 범위다 — 건드리지 마라.
- **`npm run build`를 통과시키겠다고 이 step 범위 밖의 파일(대시보드, 업로드 UI 등)을 고치지 마라.** 전체 빌드가 깨진 상태로 다음 step에 넘어가는 게 이번 마이그레이션의 의도된 중간 상태다.
- 기존 테스트를 깨뜨리지 마라.
