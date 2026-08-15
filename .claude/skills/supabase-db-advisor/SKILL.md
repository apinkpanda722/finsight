---
name: supabase-db-advisor
description: finsight Supabase 프로젝트를 MCP get_advisors(보안+성능)로 진단하고, 발견을 4티어(🟢 안전 자동수정·🟡 판단 필요·⚙️ 설정(비SQL)·⚪ 유지 권장)로 분류해 정확한 수정 SQL과 함께 제안한다. 기본은 **제안만** — 사용자가 승인한 항목만 supabase/migrations 파일 기록 + MCP apply_migration으로 적용하고, 적용 후 advisor를 재실행해 해소를 검증한다. 보안 WARN 이상은 함수 본문·라우트·기존 마이그레이션까지 코드 교차분석해 의도를 판정한다. DROP·파괴적·비SQL 설정 항목은 승인해도 자동 적용하지 않고 수동 절차를 안내한다. "DB 어드바이저 돌려줘", "db advisor", "데이터베이스 보안/성능 점검(감사)", "supabase advisor 리포트", "RLS/인덱스 점검해줘", "DB 취약점/성능 리포트 보여줘", 마이그레이션 직후 "이거 문제없나 봐줘" 같은 요청에 반드시 트리거. 절대 사용자 승인 없이 migration을 원격에 적용하지 않는다.
user-invocable: true
---

# Supabase DB Advisor — 진단 → 분류 → 제안 → (승인 시) 적용 → 검증

Supabase MCP `get_advisors`로 finsight의 라이브 DB를 진단하고, 각 lint를 **4티어**로 분류해 정확한 수정과 함께 제안한다. **DB는 기본적으로 건드리지 않는다(제안만).** 사용자가 명시적으로 승인한 항목만 `supabase/migrations` 파일 기록 + MCP `apply_migration`으로 적용하고, 적용 직후 advisor를 재실행해 해소를 검증한다.

> 이 스킬은 **라이브 DB lint**(MCP)가 대상이다. 레포 **코드** OWASP 감사는 `owasp-security-scan`, PR diff 리뷰는 `/review-code`가 담당한다 — 역할이 다르다. 병렬 서브에이전트도 쓰지 않는다 — 매 항목마다 승인을 기다리는 순차 대화형 작업이라 fan-out이 의미 없다.

## 핵심 원칙 (non-negotiable)
- **제안만이 기본.** 스킬이 스스로 DB를 바꾸지 않는다. 적용은 사용자 명시 승인 후에만, 위험도와 무관하게 항목마다.
- **승인 시 적용은 파일 + MCP 둘 다** — 레포(`supabase/migrations`)가 remote 이력을 그대로 미러하도록 동기화한다. 한쪽만 하면 레포가 거짓이 된다.
- **파괴적·비SQL은 자동 적용 금지** — `DROP`/`TRUNCATE`/`ALTER ... DROP` 등 파괴적 작업과 ⚙️ config(Auth/플랫폼 설정)는 승인해도 자동 적용하지 말고 수동 절차를 안내한다.
- **코드 교차분석** — 보안 WARN 이상은 함수 본문·호출 라우트·기존 마이그레이션을 직접 읽어 의도를 판정한 뒤 티어를 정한다. lint 문구를 그대로 베끼지 않는다.
- **오탐을 솔직히** — 저트래픽 신규 서비스의 `unused_index`처럼 lint가 오탐인 경우 ⚪ keep으로 분류하고 "왜 유지인가"를 설명한다. 무리해서 "다 고침"으로 포장하지 않는다.
- **git 커밋/브랜치/PR은 스스로 하지 않는다.** 파일 생성 + 원격 DB 반영까지만. 커밋은 사용자가 별도로 요청할 때(전역 CLAUDE.md 규칙).

## When to use
- "DB 어드바이저 돌려줘", "db advisor", "데이터베이스 보안/성능 점검(감사)해줘"
- "supabase advisor 리포트 보여줘", "RLS/인덱스 점검해줘", "DB 취약점 있나 봐줘"
- 마이그레이션(스키마 변경) 직후 회귀 점검

## 0. 대상 프로젝트 결정
1. MCP `list_projects`로 조회한다. **`name`이 `finsight`이고 `status`가 `ACTIVE_HEALTHY`인 항목**을 쓴다 — 같은 조직에 무관한 프로젝트(예: 다른 실험용 프로젝트, 대개 `INACTIVE`)가 섞여 있을 수 있다.
2. `ACTIVE_HEALTHY` 후보가 2개 이상이라 모호하면 **사용자에게 묻는다**(임의로 고르지 않는다).
3. 인자로 프로젝트를 명시했으면 그것을 우선한다.

## 1. Scan (MCP)
보안·성능을 **동시에** 떠온다(스크립트 불필요 — MCP가 곧 스캐너):
```
get_advisors(project_id=<ref>, type="security")
get_advisors(project_id=<ref>, type="performance")
```
각 lint의 `name`(=lint id)·`level`(ERROR/WARN/INFO)·`categories`·`detail`·`metadata`·`remediation`·`cache_key`를 보존한다. `cache_key`는 적용 후 재검증에서 "해소됐는지" 판정에 쓴다.

## 2. Classify — 4티어 + 코드 교차분석
`references/advisor-rubric.md`의 표로 각 lint의 **기본 티어**를 잡고, 필요하면 조정한다.

| 티어 | 의미 | 적용 정책 |
|---|---|---|
| 🟢 **auto** | 동작 불변의 기계적 수정 | 승인 시 파일+MCP 적용 |
| 🟡 **judgment** | 앱 맥락에 따라 정/오답이 갈림 | **코드 교차분석 후** 제안, 승인 시 적용 |
| ⚙️ **config** | SQL로 못 고침(Auth/플랫폼 설정) | 수동 절차 안내(자동 적용 X) |
| ⚪ **keep** | 오탐 가능성 높거나 의도된 상태 | 적용 금지, 유지 근거 설명 |

**코드 교차분석은 보안 WARN 이상에서 필수.** 예: `authenticated_security_definer_function_executable`이면
- 함수 정의를 읽는다: `execute_sql("select pg_get_functiondef('public.<fn>(<args>)'::regprocedure)")` 또는 `supabase/migrations`에서 정의를 찾는다.
- 호출부를 읽는다: `src/`에서 함수명을 grep해 누가 어떤 클라이언트(사용자 세션 vs service_role)로 호출하는지 확인한다.
- `references/advisor-rubric.md`의 결정 트리(본문이 소유권을 강제하는가 / service_role 전용 호출인가)로 판정 → 티어 확정.

성능·INFO 항목은 DB 메타(`pg_policies`, `pg_indexes`, `pg_stat_user_indexes` 등)만으로 판정 가능한 경우가 많다.

각 finding에 대해 산출: `tier`, `verdict`(왜 이 티어인가 — 코드/메타 근거), `fix`(정확한 수정 SQL 또는 수동 절차 텍스트), `status`(초기값 `proposed`/`manual`/`kept`).

## 3. Report (live, 터미널 마크다운)
티어별로 묶어 한눈에 보여준다. 각 finding: `[level] lint · 대상` + 1줄 verdict + 수정 SQL(있으면). 상단에 posture(판정 기준은 아래)와 티어별 카운트.

## 4. Propose — 여기서 **멈춘다**
- 🟢 auto / 🟡 judgment 항목은 **정확한 수정 SQL**과 함께 "적용할까요?"를 제시하되 **적용하지 않는다**.
- ⚙️ config는 수동 절차만 안내(적용 대상 아님).
- ⚪ keep은 "유지 권장 + 근거"만. 수정 제안하지 않는다.
- 사용자가 어떤 항목을 승인하는지 기다린다. "전부"라고 해도 keep/config/파괴적은 5단계 규칙을 그대로 따른다.

## 5. Apply on approval (파일 + MCP, 검증 동반)
사용자가 **명시적으로 승인한** 🟢/🟡 항목만, 항목(또는 승인받은 묶음)별로:

1. **SQL 확정** — 🟢는 루브릭의 정형 패턴, 🟡는 코드 교차분석으로 도출한 SQL. **파괴적 구문(DROP/TRUNCATE/ALTER…DROP) 포함 금지**(아래 별도 처리).
2. **MCP 적용** — `apply_migration(project_id, name="<snake_case>", query="<SQL>")`.
3. **version 확인** — `list_migrations`로 방금 부여된 정확한 `version`을 이름으로 찾는다.
4. **파일 미러** — 같은 version·SQL로 `supabase/migrations/<version>_<name>.sql`을 생성한다(헤더 주석에 출처 lint·날짜를 남긴다). 이 순서(적용 → 버전 확인 → 파일 작성)를 지켜야 로컬 파일명과 원격 이력이 어긋나지 않고, 이후 `supabase db push`가 멱등하게 유지된다.
5. **검증** — `get_advisors` 재실행 → 해당 `cache_key`가 사라졌는지 확인. 사라졌으면 `status=applied`. 아직 남아 있으면 advisor 캐시 반영 지연일 수 있으니 바로 "실패"로 단정하지 말고, 필요하면 `pg_indexes`/`pg_policies` 등 카탈로그를 직접 조회해 실제 반영 여부를 확인한다. 정말 실패했다면 롤백 SQL을 안내하고 상태를 원복한다(silent fail 금지).

**파괴적/⚙️ config/⚪ keep 처리:**
- **파괴적(예: 인덱스 DROP)** — 승인해도 MCP 자동 적용 **금지**. `supabase/migrations` 파일만 만들고 "직접 `supabase db push`로 적용하세요"로 유도하며, 되돌리기 어려움을 한 줄로 경고한다.
- **⚙️ config(예: leaked password protection·MFA·PG 업그레이드)** — `apply_migration` 불가. Dashboard 경로 또는 Management API 절차를 정확히 안내(`status=manual`).
- **⚪ keep** — 적용하지 않는다. 사용자가 그래도 원하면 위험(예: 인덱스 DROP 후 트래픽 증가 시 풀스캔)을 경고하고 **명시적 재확인** 뒤에만, 파괴적이면 위 규칙(파일만)을 그대로 적용한다.

## 6. 스냅샷 — HTML 대시보드 + JSON
출력 경로: 레포에 `docs/`가 있으면 `docs/`, 없으면 `.claude/`(finsight는 `docs/`가 있으므로 기본은 `docs/supabase-db-advisor.html`).

- `assets/template.html`을 출력 경로로 복사한 뒤 **`<script id="advisor-data">` JSON 블록만 교체**한다(HTML/CSS·렌더러는 건드리지 않는다 — 디자인 일관성).
- 동일 객체를 `docs/supabase-db-advisor.json`로도 저장(다른 도구가 소비 가능).
- 채울 필드: `project·project_ref·date(오늘)·posture{label,level,desc}·counts{security,performance,proposed,applied,kept}·tiers[{key,n}]·findings[]`. finding은 `{lint,title,category,level,tier,status,target,detail,verdict,fix,remediation,migration_file?}` — `migration_file`은 적용된 항목에 한해 `supabase/migrations/...` 경로를 채운다(있으면 대시보드가 fix 아래에 표시).

```bash
open docs/supabase-db-advisor.html   # macOS. "열지 마라" 하면 경로만 알림
```

## 7. 요약 보고 (한 문단)
1. **posture**(예: `Hardening Recommended — 보안 WARN 2`)
2. 티어별 카운트(🟢 N · 🟡 N · ⚙️ N · ⚪ N)
3. 적용/검증 결과(승인·적용·검증된 항목 N, 수동 필요 N)
4. 생성/수정된 **파일 경로**

## Posture 판정
- 보안 ERROR ≥ 1 → **Action Required** (`red`)
- 보안 WARN ≥ 1 또는 성능 WARN ≥ 1 → **Hardening Recommended** (`amber`)
- WARN 0, INFO만 → **Healthy** (`green`)

## Style rules
- HTML은 `assets/template.html` 복사 후 **데이터만** 교체. 처음부터 쓰지 않는다(owasp-security-scan과 시각적 일관성).
- 폰트 Inter(본문)+JetBrains Mono(숫자/코드·SQL), 배경 `#fafafa` 라이트. 다크모드·차트 라이브러리·이모지 장식 금지(티어 dot·pill만).
- 모든 finding은 **근거 필수**(코드/메타 인용). 추측성 finding 금지.

## Common pitfalls
- **lint를 그대로 finding으로 적용** — `unused_index`(저트래픽 오탐)·`rls_enabled_no_policy`(RPC 전용 deny-all)를 무지성으로 "고침" 처리하면 멀쩡한 걸 망친다. 반드시 코드/맥락을 확인한다.
- **제안 없이 바로 적용** — 기본은 제안만. 승인 없이 `apply_migration` 호출 금지.
- **파일/DB 드리프트** — MCP만 적용하고 `supabase/migrations` 파일을 안 남기면 레포가 거짓이 된다. 5단계 4번을 빼먹지 않는다.
- **파괴적 작업 자동 적용** — DROP은 승인해도 파일만. MCP 자동 적용 금지.
- **config를 SQL로 고치려 함** — leaked password protection·MFA·PG 업그레이드는 `apply_migration` 불가. 수동 안내.
- **RLS 정책 래핑 오류** — `auth_rls_initplan` 수정 시 `qual`/`with_check`의 `auth.x()`만 `(select auth.x())`로 감싸야 한다. 정책 의미(USING/WITH CHECK·cmd·roles)를 바꾸지 않는다.
- **revoke만으로 안심** — `authenticated_security_definer_function_executable`에서 `revoke ... from public`은 `anon`/`authenticated`에 직접 grant된 권한을 회수하지 못한다. 실제 grantee를 확인하고 그 role을 명시해서 revoke한다.

## Files
- `references/advisor-rubric.md` — 4티어 분류 루브릭 + 공통 lint→티어 표 + 티어별 수정 패턴(SQL) + 코드 교차분석 결정 트리 + finsight 고정 사실
- `assets/template.html` — 데이터 주도형 라이트 대시보드. `advisor-data` JSON만 교체하면 렌더
