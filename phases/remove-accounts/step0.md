# Step 0: schema-migration

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 특히 "패턴" 섹션의 `accounts` 엔티티 제거(ADR-011) 관련 규칙
- `/docs/ADR.md` — ADR-005(composite FK), ADR-011(계좌 제거 결정), ADR-012(PDF 리포트, 이번 step 범위 아님)
- `/docs/PRD.md` — 요금제 섹션(Free: 3개월 히스토리 / Pro: 무제한 + PDF 리포트, 계좌 개수 제한 없음)
- `supabase/migrations/20260807090833_initial_schema.sql` — `accounts` 테이블(정의부 44~58행), `uploaded_statements`(63~90행, `account_id` FK는 86행), `create_statement_upload` RPC(189~254행), `finalize_statement` RPC(259행~) 전체를 정확히 읽어라. 이 step은 이 파일들의 내용을 정확히 알아야 안전하게 마이그레이션을 작성할 수 있다
- `supabase/migrations/20260807091105_harden_handle_new_user.sql`, `supabase/migrations/20260808110406_add_invalid_pdf_failure_code.sql` — 기존 마이그레이션 스타일 참고

## 작업

`supabase/migrations/`에 새 타임스탬프 마이그레이션 파일을 하나 추가한다(파일명 컨벤션은 기존 파일들과 동일하게 `<UTC 타임스탬프>_remove_accounts.sql`).

1. **`accounts` 테이블 제거**: RLS 정책(`select own accounts`)과 테이블 자체를 drop한다. `uploaded_statements`가 `foreign key (user_id, account_id) references public.accounts(user_id, id)`로 참조 중이므로, `uploaded_statements`의 `account_id` 컬럼(및 그 FK)을 먼저 drop한 뒤 `accounts` 테이블을 drop해야 한다.
2. **`uploaded_statements.detected_label`** 컬럼 추가: `text`, nullable (파싱 실패 시 null로 남을 수 있다). 표시용 문자열일 뿐이므로 별도 제약(check/unique)은 두지 않는다.
3. **`create_statement_upload` RPC 재정의**: `p_account_id uuid`, `p_new_account_label text` 파라미터와 계좌 조회/생성/Free-1계좌 검사 블록(현재 마이그레이션 파일 223~238행)을 전부 제거한다. 나머지(advisory lock, profile 존재 확인, 일 10회 rate limit 검사, `upload_usage` 기록)는 그대로 유지한다.
   - 새 시그니처: `create_statement_upload(p_user_id uuid, p_file_name text, p_declared_size integer) returns table (statement_id uuid, storage_path text)`
   - `uploaded_statements` insert에서 `account_id` 컬럼/값을 뺀다
   - 기존 함수 시그니처(`uuid, uuid, text, text, integer`)에 대한 `revoke`/`grant`도 새 시그니처(`uuid, text, integer`)로 다시 작성한다(Postgres는 파라미터 목록이 다르면 별개 함수로 취급하므로 기존 함수를 `drop function`으로 명시적으로 지워야 한다)
4. **`finalize_statement` RPC 재정의**: `p_detected_label text default null` 파라미터를 추가하고, 함수 마지막의 `uploaded_statements` UPDATE 문에 `detected_label = coalesce(p_detected_label, detected_label)`를 추가한다(호출부가 값을 안 넘기거나 null을 넘기면 기존 값을 보존). 나머지 로직(reconciliation 검증, transactions 교체)은 그대로 둔다.
5. 이 마이그레이션을 `mcp__supabase__apply_migration`으로 직접 적용한다(mvp phase step1과 동일한 방식). 적용 후 `mcp__supabase__generate_typescript_types`로 `src/types/supabase.ts`를 재생성해 덮어쓴다.
6. `mcp__supabase__get_advisors`(security, performance)로 새로 생긴 경고가 없는지 확인한다.

## Acceptance Criteria

**중요**: 이 step 이후 `npm run build`/`npm test`는 전체적으로 실패한 상태로 남는 게 정상이다. `src/app/**`, `src/services/*.ts` 등 애플리케이션 코드는 여전히 옛 `accounts`/`account_id`/구 RPC 시그니처를 참조하고 있고, 그건 step 1~3이 고친다(전체 그린 빌드는 step 3 완료 후에나 성립한다). 이 AC는 그 사실을 알고 **스키마/RPC 변경 자체만** 좁게 검증한다 — 프로젝트 전체 빌드/테스트를 통과시키려고 금지사항에 적힌 애플리케이션 코드를 고치려 들지 마라.

```bash
git status --short   # supabase/migrations/ 아래 새 파일 하나만 추가됐어야 한다 (src/types/supabase.ts 변경 포함)
```

아래는 `mcp__supabase__execute_sql`로 직접 실행해서 확인한다(코드로 작성할 필요 없음):
- `select * from public.accounts limit 1;` → "relation does not exist" 에러가 나야 한다(테이블 삭제 확인)
- `select column_name from information_schema.columns where table_name = 'uploaded_statements' and column_name in ('account_id', 'detected_label');` → `account_id`는 없고 `detected_label`만 나와야 한다
- `select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'create_statement_upload';` → 새 시그니처(`p_user_id uuid, p_file_name text, p_declared_size integer`)만 있어야 한다(옛 5-인자 버전이 남아있으면 안 된다 — `drop function`이 빠졌다는 뜻)
- `select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'finalize_statement';` → `p_detected_label`이 포함돼 있어야 한다

`src/types/supabase.ts`가 실제로 재생성됐는지도 `grep -c '"accounts"' src/types/supabase.ts`(0이어야 함)와 `grep -c "detected_label" src/types/supabase.ts`(1 이상)로 확인한다.

## 검증 절차

1. 위 4가지 SQL 확인 + `git status --short`/grep 확인을 직접 실행한다. **`npm run build`나 `npm test`(특히 `integration-verification.integration.test.ts`)가 실패하는 것 자체는 이 step의 실패가 아니다** — 애플리케이션 코드가 아직 구 스키마를 참조 중이라 당연히 실패한다. 실패 로그를 보고 이 step의 범위(마이그레이션/RPC/타입) 밖의 파일을 고치려 들지 마라.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md/ADR-011의 설계 의도(계좌 엔티티 완전 제거, 라벨은 표시용 텍스트일 뿐)를 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙 위반 없는가? (accounts/uploaded_statements/transactions 쓰기는 RPC를 통해서만 — 이번 step은 RPC 자체를 수정하는 것이므로 해당 규칙의 예외가 아니라 규칙을 구현하는 부분임에 유의)
3. 결과에 따라 `phases/remove-accounts/index.json`의 step 0을 업데이트한다:
   - 위 4가지 SQL 확인이 전부 기대한 결과이고 `git status --short`가 마이그레이션 파일 + `src/types/supabase.ts` 외 아무것도 건드리지 않았다면 → `"status": "completed"`, `"summary"`에 새 마이그레이션 파일명과 RPC 시그니처 변경 내용을 한 줄로 요약(빌드/테스트가 깨진 상태로 넘어간다는 점도 summary에 남겨서 다음 step이 알 수 있게 한다)
   - 마이그레이션/RPC 자체가 SQL 확인을 통과 못 하면(스키마 변경이 잘못 적용된 경우) → 3회 시도 후에도 실패 시 `"status": "error"`
   - Supabase 프로젝트 연결/권한 문제로 막히면 → `"status": "blocked"`

## 금지사항

- `finalize_statement`의 reconciliation 검증 로직(row_index 완전성 검사)은 이번 step과 무관하니 건드리지 마라.
- `has_locked_history()` RPC는 `accounts`를 참조하지 않으므로 수정하지 마라.
- **`npm run build`나 `npm test`를 통과시키겠다고 `src/services/*.ts`, `src/app/**`, `src/components/**`의 애플리케이션 코드를 단 한 줄도 고치지 마라.** 이 step 직후엔 프로젝트 전체 빌드/테스트가 깨진 상태인 게 정상이고 의도된 것이다 — 다음 step들(1~3)이 새 RPC 시그니처에 맞춰 호출부를 고쳐서 빌드를 되살린다. 이번 step은 순수하게 마이그레이션 SQL 파일 + `src/types/supabase.ts` 재생성만 다룬다.
