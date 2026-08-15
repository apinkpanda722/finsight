# OWASP Top 10 2025 — 점검 루브릭 (범용 + finsight 휴리스틱)

각 카테고리마다 **무엇인가 / 일반 점검 포인트 / finsight 휴리스틱 / severity 가이드**를 담는다.
출처: https://owasp.org/Top10/2025/ · finsight 휴리스틱은 `/CLAUDE.md`의 CRITICAL 규칙 + 실제 스키마(`supabase/migrations/*.sql`)에서 유도.

> 카테고리 에이전트는 **자기 담당 카테고리 섹션 + 해당 leads + 가드레일 문서**만 받아 점검한다.
> leads는 grep이 찾은 *단서*일 뿐 판정이 아니다 — 코드를 직접 읽고 실제 의미로 확인/기각하라.

severity 척도(보안 표준): **critical · high · medium · low · info**
- critical: 인증 우회·미인증 데이터 노출·RCE·평문 비밀 유출 등 즉시 악용 가능
- high: 권한 상승·민감정보 노출·서명 미검증 등 악용 경로 명확
- medium: 조건부 악용·심층방어 결여·설정 미흡
- low: 모범사례 위반·정보성
- info: 관찰/관측, 위험 낮음

## finsight 보안 아키텍처 요약 (에이전트가 판정 기준으로 삼을 사실)
- **RLS**: `profiles`/`uploaded_statements`/`upload_usage`/`transactions` 전부 `enable row level security` + `(select auth.uid()) = user_id` 정책. `transactions`는 여기에 더해 Free 플랜의 "최근 3개월 이전 거래 열람 금지"까지 RLS 정책 자체에 내장(`transaction_date >= ... or plan='pro'`).
- **쓰기 경로**: `create_statement_upload`/`finalize_statement`는 `SECURITY DEFINER` 함수이며 **`service_role`에만 GRANT**(authenticated/anon은 실행 불가). 두 함수 모두 `p_user_id` 인자를 그대로 신뢰한다 — **RPC 자체는 호출자가 진짜 그 사용자인지 검증하지 않는다.** 따라서 이 값을 요청 body/param이 아니라 서버가 `getUser()`/`getClaims()`로 얻은 세션 사용자 id로만 채우는 것이 유일한 방어선이다.
- **Storage 경로**: `finalize_statement` 내부에서 `p_user_id || '/' || v_statement_id`로 서버가 직접 생성(`gen_random_uuid()`) — 클라이언트가 보낸 원본 `file_name`은 경로에 쓰이지 않는다.
- **Rate limit**: `upload_usage`(append-only)에 대해 `authenticated` 역할용 정책이 **의도적으로 없음** — RPC를 통해서만 기록/조회. RPC 내부에서 `pg_advisory_xact_lock`으로 24시간 10회 제한을 원자적으로 검사.
- **과거 이력 존재 여부**: `has_locked_history()`는 `SECURITY DEFINER`, boolean만 반환(실제 데이터 미노출).
- **정합성**: `finalize_statement`는 `row_index` 개수/min/max를 reconciliation한 뒤 단일 트랜잭션으로 교체 삽입 — CHECK 제약 위반 시 함수 전체가 자동 rollback.

---

## A01:2025 — Broken Access Control
**무엇:** 권한이 제대로 강제되지 않아 인가되지 않은 리소스/행위에 접근. OWASP 1위.

**일반 점검:**
- 객체/함수 수준 인가(IDOR): 사용자가 `id`만 바꿔 남의 리소스에 접근 가능한가.
- 서버측에서 모든 요청에 대해 소유권/역할을 재검증하는가(클라 신뢰 금지).
- 기본 거부(deny-by-default)인가, 누락된 경로가 열려 있지 않은가.
- 경로 탐색(`../`), 강제 브라우징, CORS 오설정으로 인한 인가 우회.

**finsight 휴리스틱(CRITICAL):**
- 새 테이블에 RLS가 누락되거나, 기존 RLS 정책이 `(select auth.uid()) = user_id` 없이 만들어졌는가 — `supabase/migrations/*.sql` 전수 확인. 누락 = critical.
- 서버가 인가 판단에 `getSession()`을 쓰는가 — `getUser()`/`getClaims()`만 허용. `getSession()` 오용 = high.
- API route가 `create_statement_upload`/`finalize_statement`를 호출할 때 `p_user_id`/`userId`를 요청 body·query·헤더에서 받아 그대로 넘기는가(RPC 자체는 검증하지 않음을 상기) — 세션 사용자 id가 아닌 값이 흘러들어갈 수 있으면 **critical**(타인 명의로 statement 생성·거래 주입 가능).
- 서비스/API 코드가 `service_role` 클라이언트로 `transactions`를 직접 조회하면서 RLS의 Free 3개월 제한을 우회하는가 — 위반 시 major.
- `has_locked_history()` 대신 실제 과거 거래를 조회해 "존재 여부"를 UI에 노출하는 코드가 있는가 — major.
- Polar `checkout`/`portal` 라우트가 product ID·customer ID를 body/query에서 받고 서버가 세션 사용자 + `POLAR_PRO_PRODUCT_ID`로 고정하지 않는가 — high(타인 명의 결제 귀속 위험).

---

## A02:2025 — Security Misconfiguration
**무엇:** 안전하지 않은 기본값·불완전한 설정·과도한 노출. (2025에 순위 상승)

**일반 점검:**
- 비밀이 클라이언트 번들/공개 응답으로 새는가(`NEXT_PUBLIC_*`에 시크릿).
- 디버그 모드/상세 에러/스택트레이스가 프로덕션에 노출되는가.
- 보안 헤더(CSP, HSTS, X-Content-Type-Options, X-Frame-Options) 부재.
- CORS 와일드카드(`*`) + credentials, 열린 관리 엔드포인트.
- TLS 검증 비활성화(`rejectUnauthorized:false`), 불필요한 기능/포트 노출.

**finsight 휴리스틱:**
- `NEXT_PUBLIC_`에 `ANTHROPIC_API_KEY`/`POLAR_*_SECRET`/`SUPABASE_SERVICE_ROLE_KEY` 등 비밀 패턴 — critical 후보(번들에 박혀 영구 유출).
- `src/lib/supabase/`의 service_role 클라이언트 생성 코드가 서버 전용 파일(route handler/서비스 계층)에서만 import되는가, 클라이언트 컴포넌트에서 import 가능한 경로가 없는가.
- `next.config.ts`/미들웨어에 보안 헤더 설정이 없는 것은 MVP 단계에서는 흔한 갭이다 — finding으로 싣되 low로 취급(과장 금지).

---

## A03:2025 — Software Supply Chain Failures
**무엇:** 의존성·서드파티 컴포넌트·빌드 파이프라인의 취약점/변조. (2025 신규 확장 — 기존 "Vulnerable & Outdated Components"보다 넓음: 빌드·배포·레지스트리까지)

**일반 점검:**
- 알려진 취약점이 있는 의존성(`npm audit` critical/high).
- lockfile 고정 여부, 신뢰 불가 출처 패키지, typosquatting.
- `postinstall` 등 빌드 스크립트의 임의 코드 실행, CI/배포 토큰 노출.
- 의존성 무결성(SRI, lockfile 무결성).

**finsight 휴리스틱:**
- `scan.py`의 `supply_chain`(npm audit) 결과를 그대로 반영. critical/high advisory는 각각 finding으로.
- 미설치 스캐너(osv-scanner/gitleaks/semgrep)로 인한 커버리지 공백을 finding이 아니라 **coverage gap**으로 정직히 표기.
- 핵심 SDK(`@anthropic-ai/sdk`·`@supabase/*`·`@polar-sh/sdk`·`@polar-sh/nextjs`)가 최신/고정인지.
- `.github/workflows/*.yml`이 있다면 서드파티 액션을 태그가 아닌 커밋 SHA로 고정했는지, `permissions`가 필요 이상으로 넓은지(기본 write-all 등).
- 결정론적 결과가 대부분이므로 LLM은 advisory 우선순위·실제 사용 여부(직접 의존 vs 트랜지티브)만 보강.

---

## A04:2025 — Cryptographic Failures
**무엇:** 민감 데이터의 부적절한 암호화·보호. (전송/저장 중 평문, 약한 알고리즘)

**일반 점검:**
- 전송/저장 중 민감정보 평문, 약한 해시(md5/sha1), 약한/하드코딩 키.
- 예측 가능한 난수(`Math.random()`)를 토큰/세션/OTP에 사용.
- 비밀번호 평문/약한 해싱, 솔트 부재.

**finsight 휴리스틱:**
- `statement_id`/`storage_path`는 Postgres `gen_random_uuid()`가 생성한다(마이그레이션 확인됨) — 애플리케이션 레이어에서 `Math.random()` 등으로 별도 식별자·토큰을 만드는 코드가 있으면 그 용도를 확인(보안 토큰이면 위반).
- 하드코딩된 API 키/토큰/비밀(`scan.py` secrets 결과) — placeholder/env-ref가 아닌 실제 값이면 critical.
- 비밀번호는 Supabase Auth가 처리한다 — 애플리케이션 코드가 비밀번호를 자체 해시/저장하려는 흔적이 있으면 위반.

---

## A05:2025 — Injection
**무엇:** 신뢰 불가 입력이 쿼리/명령/마크업으로 해석됨. (SQLi, XSS, 커맨드 인젝션, 프롬프트 인젝션)

**일반 점검:**
- SQL: 문자열 보간으로 만든 쿼리(파라미터 바인딩 부재).
- XSS: `dangerouslySetInnerHTML`, 미이스케이프 사용자 입력 렌더.
- 커맨드: `child_process`/`exec`에 사용자 입력 결합.
- `eval`/`new Function` 등 동적 코드 실행.

**finsight 휴리스틱(CRITICAL):**
- Supabase 쿼리는 빌더(`.eq()`/`.filter()`)나 파라미터화 RPC를 쓰는지 — raw SQL에 문자열 보간 시 high/critical.
- **프롬프트 인젝션:** CSV의 거래 설명(description) 등 사용자 제어 텍스트가 컬럼 매핑/카테고리 분류 프롬프트에 그대로 들어간다. Claude 응답은 구조화된 스키마로만 신뢰하고, 자유 텍스트 출력을 그대로 실행/저장하지 않는지 확인.
- 컬럼 매핑은 헤더+샘플 최대 20행, 카테고리 분류는 100행 단위 batch 규칙을 지키는지 — CSV 전체를 한 번에 프롬프트에 넘기면 위반(공격 표면 확대 + A06과 겹침).
- `transaction.description`/`file_name`/`error_message`를 `dangerouslySetInnerHTML`로 렌더링하지 않는지(JSX 텍스트 노드만).

---

## A06:2025 — Insecure Design
**무엇:** 구현 버그가 아니라 **설계 단계의 보안 통제 부재**. 위협 모델링·안전한 기본값의 부재.

**일반 점검:**
- 핵심 흐름(인증·결제·권한)에 위협 모델/남용 사례 대비가 있는가.
- 레이트 리밋·쿼터·중복요청 방어 등 남용 통제.
- 신뢰 경계가 명확한가(클라이언트를 신뢰하는 설계인가).
- 실패 시 안전한 상태로 떨어지는가(fail-safe).

**finsight 휴리스틱(CRITICAL — 다수가 설계 규칙):**
- 서비스 함수(`src/services/*.ts`)가 Supabase/Anthropic 클라이언트를 `deps: { supabase, anthropic }`로 주입받는가 — 내부에서 직접 `createServerClient()`/`new Anthropic()` 호출은 경계 붕괴(medium, SDK 인스턴스화 전용 래퍼 `lib/{supabase,polar,anthropic}/*`는 예외).
- API route handler가 얇게 유지되고 실제 로직을 서비스 함수로 위임하는가.
- 업로드 rate limit(`upload_usage` 24시간 10회)이 `create_statement_upload` RPC 내부에서 `pg_advisory_xact_lock`으로 원자적으로 처리되는가 — 애플리케이션 레이어에서 먼저 count 조회 후 나중에 insert하는 TOCTOU 패턴으로 재구현되어 있으면 위반(race로 남용 가능).
- CSV 업로드 크기(≤2,000행)·인코딩(UTF-8/CP949)·구조(RFC 4180) 검증이 클라이언트 신뢰가 아니라 서버(서비스 계층)에서 강제되는가.
- 날짜/금액 변환과 부호 규칙이 결정론적 코드로 수행되고, Claude 응답(카테고리 분류)을 날짜/금액처럼 정확해야 하는 값에 대신 쓰지 않는가.

---

## A07:2025 — Authentication Failures
**무엇:** 신원 검증의 약점. (세션 관리, 자격증명, OAuth 흐름)

**일반 점검:**
- 세션 토큰의 안전한 생성/저장/만료, 고정(fixation)·재사용 방어.
- 자격증명 스터핑·무차별 대입 방어(레이트 리밋), 약한 비밀번호 정책.
- OAuth/이메일 인증 흐름의 토큰 검증, redirect 화이트리스트.

**finsight 휴리스틱(CRITICAL):**
- 서버가 `getUser()`/`getClaims()`로 토큰을 **네트워크 검증**하고 `getSession()`(로컬 쿠키)을 신뢰하지 않는지 — A01과 공유.
- 회원가입/비밀번호 재설정 흐름이 Supabase Auth 기본 플로우를 벗어나 커스텀 토큰을 자체 저장/검증하려는 흔적이 있는지.
- 미들웨어가 보호 경로(`(dashboard)/*`, `/api/*` 중 인증 필요 라우트)를 일관되게 가드하는지.

---

## A08:2025 — Software or Data Integrity Failures
**무엇:** 무결성 검증 없는 코드/데이터(역직렬화, 자동 업데이트, CI/CD 변조, 서명 미검증).

**일반 점검:**
- 신뢰 불가 데이터 역직렬화, 서명/무결성 검증 없는 외부 입력 수용.
- 웹훅·콜백의 출처 검증 부재.
- CI/CD 파이프라인·배포 아티팩트 무결성.

**finsight 휴리스틱(CRITICAL):**
- **웹훅(Polar) 무결성:** `src/app/api/webhooks/polar/route.ts`가 raw body 기준 서명검증을 파싱 전에 수행하는가. 서명 검증 전에 body를 읽어 처리하면 high(위조 payload 수용).
- `profiles.plan`/구독 스냅샷 필드(`subscription_status`, `polar_subscription_id`, `current_period_end`, `cancel_at_period_end`, `polar_modified_at`)를 검증된 webhook 코드(service_role) **밖에서** 갱신하는 경로가 있는가 — critical.
- 이벤트가 `profiles.polar_modified_at`보다 새로울 때만 UPDATE하는가 — stale/역순 webhook 이벤트가 최신 구독 상태를 되돌리면 high.
- `accounts`(현재 스키마엔 없음)/`uploaded_statements`/`transactions`에 대한 쓰기가 `create_statement_upload`/`finalize_statement` RPC를 우회해 route handler에서 직접 `.insert()`/`.update()`하는 경로가 있는가 — RPC가 `service_role`에만 GRANT되어 있으므로 우회 시도는 곧 권한 상승 시도다. critical.
- `finalize_statement`의 `row_index` reconciliation(개수/min/max 일치, CHECK 제약 기반 자동 rollback)을 우회하는 별도 INSERT 경로가 있는가.

---

## A09:2025 — Security Logging and Alerting Failures
**무엇:** 보안 이벤트의 로깅·탐지·경보 부재로 침해를 놓침. (2025: "Alerting" 강조)

**일반 점검:**
- 인증 실패·권한 거부·결제 이상 등 보안 이벤트가 로깅되는가.
- 로그에 **민감정보(비밀·전체 식별자·토큰)가 새지 않는가** — 로깅 자체가 누출 벡터가 될 수 있음.
- 이상 탐지·경보 경로가 있는가(없으면 medium/low, 설계 한계).

**finsight 휴리스틱:**
- [과다 로깅 — CLAUDE.md CRITICAL 위반] CSV 원문, mapping/category 프롬프트, transaction description 배열, webhook payload 전체가 로그에 그대로 찍히는가 — 로그엔 `statementId`/`userId`/`errorCode`/`stop_reason`/batch 번호만 남아야 한다. 위반 시 high(PII 유출 벡터).
- [과소 로깅] 로그인 실패, webhook 서명 검증 실패, RPC 예외(`rate_limited`/`reconciliation_failed`/`profile_not_found`) 같은 보안·정합성 이벤트가 전혀 로깅되지 않아 사고 대응이 불가능한가.
- MVP 단계에서 중앙 경보(알림) 부재는 흔하다 — finding보다는 정직한 한계로 표기(low/info), 단 **민감정보 과다 로깅은 즉시 finding**.

---

## A10:2025 — Mishandling of Exceptional Conditions
**무엇:** 예외/에러 처리 미흡으로 인한 정보 노출·페일오픈·정합성 붕괴. (2025 신규)

**일반 점검:**
- 빈 catch(예외 삼킴), 부분 실패가 조용히 통과.
- 에러 응답에 스택트레이스·내부 경로·SQL·키가 노출.
- 실패 시 **페일오픈**(에러인데 권한을 허용하는 방향으로 떨어짐).
- 타임아웃·취소·부분 실패에서 자원/트랜잭션이 정합성을 유지하는가.

**finsight 휴리스틱(CRITICAL):**
- transient(429/5xx/네트워크) vs permanent(refusal/스키마·reconciliation 실패) 에러 분기가 올바른가 — 섞이면 무한 재시도(리소스/쿼터 고갈) 또는 조기 포기(정상 처리 실패)가 발생.
- `uploaded_statements.processing_lease_expires_at` 기반 lease가 예외 발생 시에도 정상적으로 만료/해제되어, 좀비 lease로 인해 해당 statement의 재처리가 영구히 막히지 않는가(자원 고갈형 DoS).
- API 에러 응답이 Postgres 예외 메시지의 코드(`reconciliation_failed` 등)는 노출해도 되지만, 스택트레이스·SQL 원문·내부 경로를 그대로 노출하지 않는가.
- `finalize_statement`가 CHECK 제약 위반 시 자동 rollback되는 구조를 우회해 부분 저장을 시도하는 별도 경로가 없는가 — A08과 연계.
- 빈 catch로 webhook 서명 검증 실패나 권한 체크 실패를 삼키지 않는가.

---

## 점검 산출 규약 (모든 카테고리 공통)
- finding은 **코드 근거가 있어야** 한다(파일:라인 + 인용). 추측·일반론 금지.
- 담당 카테고리에 문제가 없으면 빈 배열 + `category_notes`에 "확인된 위반 없음 / 적용 근거"를 1줄로.
- 동일 이슈가 여러 카테고리에 걸치면 **가장 본질적인 1개 카테고리**에만 싣고 교차참조를 evidence에 적는다.
- coverage gap(미설치 도구로 못 본 영역)은 finding이 아니라 coverage로 보고.
