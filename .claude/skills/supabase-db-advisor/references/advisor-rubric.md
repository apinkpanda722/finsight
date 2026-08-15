# Supabase Advisor 루브릭 (finsight)

`get_advisors`가 내는 lint를 **4티어**로 분류하고, 티어별 처리·수정 SQL 패턴을 정의한다. 보안 WARN 이상은 코드 교차분석을 거친다. 맨 아래에 finsight 고정 사실을 포함한다.

## 4 티어
| 티어 | 의미 | 적용 정책 |
|---|---|---|
| 🟢 auto | 동작 불변의 기계적 수정. 위험 ≈ 0 | 승인 시 파일+MCP 적용 |
| 🟡 judgment | 앱 맥락에 따라 정/오답이 갈림. 코드 교차분석 필수 | 코드 확인 후 제안, 승인 시 적용 |
| ⚙️ config | SQL로 못 고침(Auth/플랫폼 설정) | 수동 절차 안내(자동 적용 X) |
| ⚪ keep | 오탐 가능성 높거나 의도된 상태 | 적용 금지. 유지 근거 설명 |

## 공통 lint → 기본 티어 (목록에 없는 lint도 이 표로 추론)
| lint | cat | level | 기본 티어 | 처리 요지 |
|---|---|---|---|---|
| `auth_rls_initplan` | PERF | WARN | 🟢 auto | 정책의 `auth.x()` → `(select auth.x())` 래핑 |
| `function_search_path_mutable` | SEC | WARN | 🟢 auto | `alter function ... set search_path = ''` |
| `policy_exists_rls_disabled` | SEC | ERROR | 🟢 auto | 정책은 있는데 RLS off → `enable row level security` |
| `unindexed_foreign_keys` | PERF | INFO | 🟢 auto* | FK 컬럼 순서 그대로 커버링 인덱스 추가. 순수 추가(additive)라 위험 낮음 — 단 테이블이 극히 작으면 🟡로 낮춰 효용을 사용자와 확인 |
| `duplicate_index` | PERF | WARN | 🟡 judgment | 중복 인덱스 DROP — **파괴적**, 판단 후 파일만 |
| `unused_index` | PERF | INFO | 🟡 judgment | DROP은 파괴적. 저트래픽 오탐 여부 먼저 판단(아래 패턴) |
| `multiple_permissive_policies` | PERF | WARN | 🟡 judgment | 정책 통합(의미가 바뀔 수 있음 — 코드 확인) |
| `security_definer_view` | SEC | ERROR | 🟡 judgment | 뷰를 `security_invoker=on`으로 재정의 |
| `rls_disabled_in_public` | SEC | ERROR | 🟡 judgment | RLS 켜고 정책 추가 — **앱이 깨질 수 있어 신중** |
| `authenticated_security_definer_function_executable` | SEC | WARN | 🟡 judgment | 아래 결정 트리 |
| `extension_in_public` | SEC | WARN | 🟡 judgment | 확장을 별도 스키마로 이동(의존 코드 확인) |
| `rls_references_user_metadata` | SEC | ERROR | 🟡 judgment | `user_metadata`는 클라이언트가 변조 가능 — 정책 재설계 |
| `rls_enabled_no_policy` | SEC | INFO | ⚪ keep* | service_role/RPC 전용 테이블이면 의도된 deny-all |
| `auth_leaked_password_protection` | SEC | WARN | ⚙️ config | Auth 설정. finsight는 이메일/비밀번호 로그인이 있어 **실질 조치 대상**(N/A 아님) |
| `auth_insufficient_mfa_options` | SEC | WARN | ⚙️ config | Auth 설정(MFA) |
| `vulnerable_postgres_version` | SEC | WARN | ⚙️ config | 플랫폼 업그레이드(수동, 다운타임 고지) |

\* `auto`/`keep`은 **기본값이지 절대 규칙이 아니다** — 코드/맥락으로 실제 갭이 드러나면 등급을 올리거나 내려라.

---

## 티어별 수정 패턴

### 🟢 `auth_rls_initplan` — RLS 정책 함수 호출 캐싱
대규모 테이블에서 `auth.uid()`가 행마다 재평가되는 문제. **동작 불변**, 순수 성능 이득.

1. 현재 정책 정의 조회:
   ```sql
   select policyname, cmd, qual, with_check, roles, permissive
   from pg_policies
   where schemaname = 'public' and tablename = '<table>';
   ```
2. `qual`(USING)·`with_check` 안의 `auth.uid()`·`auth.jwt()`·`auth.role()`·`current_setting(...)`를 `(select auth.uid())` 형태로 **그것만** 감싼다. 정책 의미·`cmd`·`roles`·`permissive`는 그대로 둔다.
3. 재적용:
   ```sql
   alter policy "<policyname>" on public.<table>
     using ( <wrapped qual> )
     with check ( <wrapped with_check> );
   ```
   `with_check`가 null이면 `with check` 절 생략. 정책이 여러 개면 각각 처리.

### 🟢 `function_search_path_mutable`
```sql
alter function public.<fn>(<args>) set search_path = '';
```
함수 본문이 비정규 스키마 객체를 참조하면 `set search_path = pg_catalog, public` 등으로 조정 — 먼저 함수 본문을 읽어 unqualified 참조가 있는지 확인한다.

### 🟢 `unindexed_foreign_keys`
FK 컬럼 순서 그대로 `create index`. composite FK((user_id, id) 패턴)면 컬럼 순서를 그대로 따른다. 예: `foreign key (user_id, statement_id) references ...(user_id, id)` → `create index ... on public.<t> (user_id, statement_id)`.

### 🟡 `authenticated_security_definer_function_executable` — 결정 트리
SECURITY DEFINER 함수를 `authenticated`가 REST RPC로 호출 가능할 때. **인자에 식별자(`p_user_id` 등)가 있으면 IDOR 위험.** 반드시 함수 본문 + 호출부를 읽는다.

```
함수가 식별자 인자(p_user_id 등)를 받고 authenticated가 호출 가능한가?
├─ 본문이 소유권을 강제하는가? (p_user_id = auth.uid() 아니면 raise, 또는 애초에 인자 없이 auth.uid()만 사용)
│   ├─ 예 → 안전. ⚪ keep. verdict에 "본문에서 소유권 검증" 근거(파일:라인).
│   └─ 아니오 ↓
├─ 앱이 service_role(서버 전용)로만 호출하는가? (src/에서 함수명 grep — 어떤 클라이언트로 호출하나)
│   ├─ 예 → 🟡 authenticated EXECUTE 회수:
│   │        revoke execute on function public.<fn>(<args>) from anon, authenticated;
│   │        (주의: public 함수는 anon/authenticated에 **직접** grant되어 있을 수 있어 `from public` revoke만으로는 안 막힌다 — 실제 grantee를 `select grantee from information_schema.role_routine_grants where routine_name = '<fn>'`로 확인 후 그 role을 명시해서 revoke)
│   └─ 아니오(클라이언트가 사용자 토큰으로 직접 호출) ↓
└─ 🟡 하드닝: 본문 첫 줄에 소유권 가드 추가
        if p_user_id <> auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;
      또는 인자 p_user_id를 제거하고 본문에서 auth.uid()를 쓰도록(호출부 동반 수정 필요 — 코드까지 보고 제안).
```
함수 재정의는 `create or replace function ...`(시그니처 동일)로. 시그니처를 바꾸면 호출부·grant에 영향을 주므로 그 자체를 별도 judgment로 다룬다.

### 🟡 `rls_disabled_in_public` / `security_definer_view`
- `rls_disabled_in_public`: `alter table public.<t> enable row level security;` + **반드시** 적절한 정책도 함께 추가한다(정책 없이 RLS만 켜면 deny-all이 되어 앱이 깨진다). 소유권 모델(`auth.uid() = user_id` 또는 composite FK 경유)을 확인한 뒤 정책을 작성해 승인받는다.
- `security_definer_view`: `alter view public.<v> set (security_invoker = on);` — 뷰 정의가 RLS를 우회하지 않게 한다.

### 🟡 `unused_index` — 저트래픽 오탐 여부부터 판단
`pg_stat_user_indexes.idx_scan = 0`은 "안 쓰임"이 아니라 "**아직** 조회가 없었음"일 수 있다. finsight처럼 트래픽이 아직 적은 신규 서비스에서는 대부분 오탐이다.
- DROP 전 확인: 이 인덱스가 RLS `user_id` 필터·FK 조회·정렬을 받치는가? 받친다면 **유지**(트래픽이 늘면 이 인덱스 없이는 풀스캔이 된다).
- 방금 우리가 만든 인덱스라면 거의 확실히 오탐 — ⚪ keep으로 분류하고 "신규 인덱스, 트래픽 축적 전"이라고 명시.
- 진짜 제거 대상은 "충분한 트래픽 기간에도 idx_scan=0 + 다른 인덱스로 대체됨"이 입증될 때뿐이다. 그때도 DROP은 파괴적이므로 파일만 만들고 수동 push로 유도한다.

### ⚪ `rls_enabled_no_policy`
RLS on + 정책 0 = **service_role 외 전원 deny**. 이게 의도라면(쓰기 전용/RPC 전용 내부 테이블) **안전한 상태**다.
- 테이블이 RPC/service_role로만 쓰이는가(마이그레이션 주석·코드에서 client 접근 없음을 확인)? → 유지(verdict에 "deny-all 의도, 근거: <파일:라인>").
- 사용자 접근이 실제로 필요한 테이블인데 정책이 빠진 거라면 → 🟡로 승격, 소유권 정책을 설계해 제안.

### ⚙️ `auth_leaked_password_protection` / MFA / PG 업그레이드
SQL로 못 고친다. 수동 절차를 정확히 안내한다:
- **Leaked password protection**: Dashboard → Authentication → Policies(Password) → "Leaked password protection" 활성화. 또는 Management API `PATCH /v1/projects/{ref}/config/auth` `{"password_hibp_enabled": true}`.
- **PG 업그레이드**: Dashboard → Settings → Infrastructure. 다운타임·호환성을 먼저 사용자에게 고지.

---

## Posture 판정
- 보안 ERROR ≥ 1 → **Action Required** (`red`)
- 보안 WARN ≥ 1 또는 성능 WARN ≥ 1 → **Hardening Recommended** (`amber`)
- WARN 0, INFO만 → **Healthy** (`green`)

---

## finsight 고정 사실 (티어 판정에 활용)
- **사용자 소유 테이블** (`(user_id, id)` composite unique + FK 패턴, RLS `auth.uid() = user_id` 계열): `profiles`, `accounts`, `uploaded_statements`, `transactions`.
- **`upload_usage`**: 삭제 불가능한 append-only 비용 집계(레이트리미팅 근거). RLS enabled, client용 정책 0건 — 마이그레이션 주석에 "authenticated 정책을 의도적으로 하나도 만들지 않는다(RPC로만 기록/조회)"라고 명시된 **의도된 deny-all**. `rls_enabled_no_policy`는 기본 ⚪ keep.
- **SECURITY DEFINER RPC**:
  - `create_statement_upload` / `finalize_statement` — quota 원자 검증 + statement 생성/완료 트랜잭션. route handler가 인증된 세션의 `p_user_id`를 넘겨 호출(클라이언트가 직접 호출하지 않음). 코드 교차분석 시 route가 `getClaims()`/`getUser()`로 확보한 사용자 id만 넘기는지 확인.
  - `has_locked_history()` — Free 사용자의 과거 거래 "존재 여부"만 반환(실제 값 노출 없음). `authenticated`가 REST RPC로 직접 호출하는 게 **의도**. 이미 `set search_path = ''` + 내부에서 `(select auth.uid())`로 호출자 범위를 제한 + `revoke all ... grant execute to authenticated`까지 명시적으로 돼 있음(`supabase/migrations/20260807090833_initial_schema.sql`) → `authenticated_security_definer_function_executable`은 결정 트리상 "본문이 소유권을 강제" 분기 → ⚪ keep.
- **인증 = 이메일/비밀번호 지원**(가입·이메일 인증·비밀번호 재설정 플로우 존재, OAuth 전용 아님) → `auth_leaked_password_protection`은 ⚙️ config이면서 **실질적으로 유효한 조치 항목**이다. N/A로 넘기지 않는다.
- `profiles.plan`과 구독 스냅샷 필드(`subscription_status`, `polar_subscription_id`, `current_period_end`, `cancel_at_period_end`, `polar_modified_at`)는 검증된 Polar webhook(service_role)에서만 갱신된다 — 이 컬럼에 client 쓰기를 허용하는 정책이 보이면 그 자체가 티어와 무관하게 즉시 보고해야 할 심각한 버그다.
- Storage 경로는 `{user_id}/{statement_id}`만 쓴다 — Storage 관련 정책 finding을 볼 때 참고.
