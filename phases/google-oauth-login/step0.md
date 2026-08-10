# Step 0: google-login-button

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/PRD.md` — 핵심 기능 1번(회원가입/로그인 플로우, Google 로그인 포함)
- `/docs/ARCHITECTURE.md` — `(auth)` 디렉토리 구조, `auth/callback/route.ts` 역할
- `/docs/ADR.md` — ADR-010 (Google OAuth를 이메일/비밀번호와 병행 추가하는 결정과 트레이드오프)
- `/docs/SETUP.md` — 2-3, 2-4 (Auth URL 설정, Google OAuth Provider 설정)
- `src/app/(auth)/login/page.tsx` — 기존 login/signup/verify 3-view 구조. 특히 `handleSignup`의 `callbackUrl`/`returnTo` 구성 로직(라인 86~90 부근)을 그대로 재사용할 것
- `src/app/(auth)/login/page.test.tsx` — 기존 mock 구조(`vi.hoisted`로 만든 `authMocks`, `createClient` mock 패턴)
- `src/lib/auth/return-path.ts` — `isSafeReturnPath`
- `src/app/(auth)/auth/callback/route.ts` — `exchangeCodeForSession`이 이미 provider-agnostic으로 동작함을 확인만 하고 수정하지 않는다

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

이 프로젝트는 TDD를 강제한다(CLAUDE.md). 아래 순서를 지켜라: 먼저 1번(테스트) 작성 → 실패 확인 → 2번(구현) → 통과 확인.

1. `page.test.tsx`의 `authMocks`(`vi.hoisted` 블록)에 `signInWithOAuth: vi.fn()`을 추가하고, `beforeEach`의 `createClient.mockReturnValue({ auth: { ... } })`에도 연결한다. 아래 케이스를 추가한다:
   - login 뷰와 signup 뷰 모두에서 "Google로 계속하기" 버튼이 렌더된다
   - 버튼 클릭 시 `signInWithOAuth`가 `{ provider: "google", options: { redirectTo: "http://localhost:3000/auth/callback" } }`로 호출된다 (returnTo 없는 기본 케이스)
   - `returnTo`가 안전한 경로(`isSafeReturnPath`가 true)면 `redirectTo`에 `?next=...`가 포함된다 — 기존 `"carries a safe returnTo through to the email verification callback link"` 테스트와 동일한 패턴으로 작성
   - `returnTo`가 안전하지 않으면(`//evil.com` 등) `redirectTo`에서 제외된다 — 기존 `"drops an unsafe returnTo..."` 테스트와 동일한 패턴

2. `page.tsx`의 `LoginContent` 함수 내부에 아래 시그니처의 핸들러를 추가한다:
   ```ts
   async function handleGoogleLogin(): Promise<void>
   ```
   - `handleSignup`에 있는 `callbackUrl`(`${window.location.origin}/auth/callback` + 안전한 `returnTo`가 있으면 `next` 쿼리 파라미터로 추가) 구성 로직을 재사용한다. 로직을 복제하지 말고 공유 가능한 형태로 추출해도 되고, 그대로 각자 구성해도 된다 — 중복이 걱정되면 작은 헬퍼 함수로 뽑아도 좋다(과한 추상화는 피할 것)
   - `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl.toString() } })`를 호출한다
   - 에러가 반환되면 기존 `setError(error.message)` 패턴으로 표시한다. 성공 시에는 브라우저가 풀페이지 리다이렉트되므로 `router.push`/`router.refresh` 호출이 필요 없다
   - login 뷰(`view === "login"`)와 signup 뷰(`view === "signup"`) 양쪽에 `variant="outline"`의 Google 로그인 버튼을 추가하고, 동일한 `handleGoogleLogin` 핸들러를 공유한다(뷰별로 별도 핸들러를 만들지 않는다)
   - 버튼 라벨/배치/아이콘 등 시각적 디테일을 정하기 전에 `finsight-design-system` 스킬을 참고한다(CLAUDE.md: 인증 화면 작업 시 필수)

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (새 파일 추가 없이 `page.tsx`/`page.test.tsx`만 수정했는가)
   - ADR-010의 결정(콜백 라우트 재사용, 별도 회원가입 페이지 없음)을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가? (특히 서비스 함수/route handler 관련 규칙 — 이번 step은 둘 다 새로 만들지 않으므로 해당 없음을 확인)
3. 결과에 따라 `phases/google-oauth-login/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(Supabase/Google 콘솔 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 새 API route나 서비스 함수를 만들지 마라. 이유: OAuth 흐름은 클라이언트 SDK 호출(`supabase.auth.signInWithOAuth`)과 기존 `/auth/callback` 라우트만으로 충분하다(ADR-010).
- `src/app/(auth)/auth/callback/route.ts`를 수정하지 마라. 이유: `exchangeCodeForSession`은 이미 provider-agnostic으로 동작한다 — 수정하면 기존 이메일 인증/비밀번호 재설정 흐름이 깨질 위험이 있다.
- login/signup 뷰마다 별도의 Google 로그인 핸들러를 만들지 마라. 이유: 두 뷰 모두 동일한 OAuth 흐름이며, 핸들러를 나누면 로직이 중복되고 한쪽만 고치는 실수가 생기기 쉽다.
- Google Cloud Console/Supabase Provider 설정 등 콘솔 수동 작업을 코드로 대신하려 하지 마라. 이유: 이 step은 애플리케이션 코드 범위이고, 콘솔 설정은 SETUP.md 2-4에 문서화된 사용자의 수동 작업이다. 관련 env 키가 없어 런타임에 실패하더라도 그것은 blocked 사유가 아니다(코드 자체는 키 없이도 빌드/테스트 통과해야 한다).
- 기존 테스트를 깨뜨리지 마라.
