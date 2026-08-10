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

```bash
npm run build   # 컴파일 에러 없음 (src/types/supabase.ts 변경분 포함)
npm test        # 테스트 통과 (이 step에서 마이그레이션 외 코드는 건드리지 않으므로 기존 테스트가 그대로 통과해야 한다)
```

추가로: `mcp__supabase__execute_sql`로 `select * from public.accounts limit 1;`을 실행했을 때 "relation does not exist" 에러가 나는 것으로 테이블이 실제로 삭제됐음을 확인한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md/ADR-011의 설계 의도(계좌 엔티티 완전 제거, 라벨은 표시용 텍스트일 뿐)를 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙 위반 없는가? (accounts/uploaded_statements/transactions 쓰기는 RPC를 통해서만 — 이번 step은 RPC 자체를 수정하는 것이므로 해당 규칙의 예외가 아니라 규칙을 구현하는 부분임에 유의)
3. 결과에 따라 `phases/remove-accounts/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 새 마이그레이션 파일명과 RPC 시그니처 변경 내용을 한 줄로 요약
   - 수정 3회 시도 후에도 실패 → `"status": "error"`
   - Supabase 프로젝트 연결/권한 문제로 막히면 → `"status": "blocked"`

## 금지사항

- `finalize_statement`의 reconciliation 검증 로직(row_index 완전성 검사)은 이번 step과 무관하니 건드리지 마라.
- `has_locked_history()` RPC는 `accounts`를 참조하지 않으므로 수정하지 마라.
- 이번 step에서 `src/services/*.ts`, `src/app/**`, `src/components/**`의 애플리케이션 코드는 수정하지 마라 — 다음 step들(1~3)이 새 RPC 시그니처에 맞춰 호출부를 고친다. 이번 step은 순수하게 스키마/RPC/타입 재생성만 다룬다. 테스트는 Supabase 클라이언트를 모킹하고 실제 RPC를 호출하지 않으므로, 서비스 레이어가 아직 구 RPC 시그니처를 호출하는 상태로 남아있어도 `npm test`는 그대로 통과해야 한다(런타임에만 깨지고, 이건 다음 step에서 고친다).
