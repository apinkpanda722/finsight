# Step 2: supabase-auth

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/scripts/hooks/tdd-guard-core.sh` (어떤 경로가 test-first 예외인지 확인)
- `.claude/skills/finsight-design-system/references/prototype/auth-screens.jsx` (인증 화면 레이아웃 참조 — `finsight-design-system` 스킬 참고)
- step 0/1에서 만들어진 `src/lib/env.ts`, `src/types/supabase.ts`, `.env.example`

## 작업

### 1. Supabase 클라이언트 래퍼 (tdd-guard 예외 — 테스트 없이 작성 가능)

`src/lib/supabase/client.ts` — 브라우저용 `createBrowserClient`(`@supabase/ssr`)를 인스턴스화만 하는 함수 export.
`src/lib/supabase/server.ts` — Server Component/Route Handler용 `createServerClient`를 쿠키 어댑터와 함께 인스턴스화하는 함수 export. `env.ts`의 검증된 값을 사용한다.

### 2. `src/middleware.ts` (Edge 런타임 — **tdd-guard 예외 아님, 먼저 `src/middleware.test.ts` 작성**)

`@supabase/ssr`의 `createServerClient` + `getClaims()`를 사용해 세션을 갱신하고 `(dashboard)` 그룹 경로를 보호한다.

```
> `createServerClient` + `getClaims()`(또는 `getUser()`)를 쓴다. `getSession()`은 쓰지 마라 —
> 이유: 로컬 JWT 검증만 하고 서버 측 무효화를 확인하지 않는다. 클라이언트 생성과 세션 확인
> 호출 사이에 다른 코드를 넣지 마라 — 이유: 세션 동기화가 깨져 사용자가 무작위로 로그아웃될
> 수 있다. 쿠키는 request/response 양쪽에 모두 set한다.
```

동작:
- 모든 요청에서 세션을 갱신(request/response 쿠키 동기화)한다.
- 요청 경로가 `(dashboard)` 그룹(`/dashboard`, `/uploads`, `/billing`, `/settings/**`)이고 인증된 사용자가 없으면 `/login?returnTo=<현재 경로>`로 리다이렉트한다.
- `matcher` 설정으로 정적 자산(`_next/static`, `_next/image`, `favicon.ico`)은 제외한다.

테스트(`src/middleware.test.ts`)는 mock `NextRequest`로 (1) 미인증 사용자가 `/dashboard` 접근 시 `/login?returnTo=%2Fdashboard`로 리다이렉트되는지, (2) 인증된 사용자는 통과하는지, (3) `(marketing)`/`(auth)` 경로는 미인증이어도 통과하는지 검증한다. Supabase 클라이언트는 `vi.mock('@/lib/supabase/server')`로 모킹한다.

### 3. `returnTo` 안전 검증

로그인 성공 후 `returnTo` 쿼리 파라미터로 리다이렉트하기 전에, 반드시 순수 함수 `isSafeReturnPath(path: string): boolean`을 만들어 검증한다 — `/`로 시작하고 `//`나 `://`를 포함하지 않는 경로만 허용한다(오픈 리다이렉트 방지). 안전하지 않으면 `/dashboard`로 대체한다. 이 함수는 tdd-guard 대상이므로 테스트를 먼저 작성한다.

### 4. 인증 페이지 (디자인은 `finsight-design-system` 스킬 참고)

`.claude/skills/finsight-design-system/references/prototype/auth-screens.jsx`에 이 화면들의 동작하는 참조 구현이 있다 — 레이아웃/상태 전이는 그대로 따르고, inline style은 Tailwind+shadcn 컴포넌트(step 0에서 설정한 pill 버튼/인풋)로 옮긴다. 공통 wrapper는 `AuthShell`(중앙 정렬된 420px 카드, 상단에 "finsight" 워드마크) 패턴을 따른다.

- **`src/app/(auth)/login/page.tsx`**: 이메일/비밀번호 로그인 폼(Client Component). `auth-screens.jsx`의 `Login()` 참고 — `justVerified` 파라미터로 들어오면 "이메일 인증이 완료되었습니다" 안내 배너를 보여준다. 성공 시 검증된 `returnTo` 또는 `/dashboard`로 이동. 실패 시 에러 메시지. "이메일을 확인하지 않았습니다" 에러가 오면 재발송 버튼을 보여준다(`supabase.auth.resend({ type: 'signup', email })`).
- **`src/app/(auth)/login/page.tsx`** 근처에 회원가입 폼도 둔다(별도 `/signup` 라우트로 분리해도 됨) — `auth-screens.jsx`의 `Signup()` 참고. `supabase.auth.signUp()` 성공 후 즉시 로그인시키지 말고, `VerifyEmail()` 패턴대로 "메일함을 확인해주세요" 안내 화면으로 전환한다(Confirm email이 켜져 있어 세션이 바로 발급되지 않는다).
- **`src/app/(auth)/forgot-password/page.tsx`**: `auth-screens.jsx`의 `ForgotPassword()` 참고. 이메일 입력 → `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/auth/callback?next=/reset-password' })`.
- **`src/app/(auth)/reset-password/page.tsx`**: `auth-screens.jsx`의 `ResetPassword()` 참고. recovery 세션에서만 접근 가능. 새 비밀번호 입력 → `supabase.auth.updateUser({ password })`.
- **`src/app/(auth)/auth/callback/route.ts`**: PKCE `code`를 `exchangeCodeForSession`으로 교환한다. `next` 쿼리 파라미터가 있으면(비밀번호 재설정 흐름) `isSafeReturnPath()` 검증 후 그 경로로, 없으면(가입 확인 흐름) `/dashboard`로 리다이렉트한다.

### 5. `(dashboard)` 레이아웃 가드

`src/app/(dashboard)/layout.tsx`에서 `getClaims()`(또는 `getUser()`)로 세션을 다시 확인한다(middleware와 이중 방어 — Server Component 캐싱/우회 가능성 대비).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm test
```

## 검증 절차

1. 위 AC를 실행한다.
2. `src/middleware.ts`와 `isSafeReturnPath`에 대응하는 테스트 파일이 구현보다 먼저 커밋됐는지 확인한다.
3. 아키텍처 체크리스트: `lib/supabase/{client,server}.ts`가 인스턴스화 외 로직을 갖지 않는지, route handler가 얇은지, `getSession()` 사용이 코드베이스 어디에도 없는지(`grep -r "getSession()" src`) 확인한다.
4. `returnTo`에 `//evil.com`이나 `https://evil.com` 같은 값을 넣었을 때 `/dashboard`로 안전하게 대체되는지 테스트로 확인한다.
5. 결과에 따라 `phases/mvp/index.json`의 step 2 항목을 업데이트한다.

## 금지사항

- `getSession()`을 어디에도 쓰지 마라 — 이유: CLAUDE.md CRITICAL 규칙, 무효화된 세션이 통과할 수 있다.
- `returnTo`/`next` 쿼리 값을 검증 없이 `redirect()`에 바로 넘기지 마라 — 이유: 오픈 리다이렉트 취약점이 된다.
- 회원가입 직후 클라이언트에서 임의로 세션을 만들거나 이메일 확인을 건너뛰지 마라 — 이유: step 1에서 Confirm email을 켜기로 이미 확정했다.
- `lib/supabase/{client,server}.ts`에 인스턴스화 이상의 로직(에러 처리, 캐싱 등)을 넣지 마라 — 이유: 이 파일들은 tdd-guard 예외이므로 테스트 없이 통과한다. 로직이 필요하면 테스트가 있는 다른 파일로 분리하라.
- 이 step에서 결제(`checkout`/`portal`), 업로드, 대시보드 데이터 조회를 구현하지 마라 — 이후 step의 범위다.
- 기존 테스트를 깨뜨리지 마라.
