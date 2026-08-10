# 프로비저닝 가이드 (SETUP.md)

이 문서는 finsight가 **실제로 회원가입/로그인·CSV 분석·Pro 결제**까지 돌아가도록 외부 서비스를 연결하는 절차다. `npm run dev`/`build`/`test` 자체는 키 없이도 실행되지만(공개 페이지는 렌더됨), 인증·업로드·결제 기능은 아래 키가 모두 채워져야 동작한다.

- 콘솔에서 직접 해야 하는 **수동 단계**는 `[수동]`으로 표시했다.
- 모든 비밀키는 `.env`에만 두고 커밋하지 않는다(`.gitignore`에 이미 포함).
- 미설정 상태에서도 랜딩(`/`)·로그인(`/login`)은 렌더되고, 보호 경로(`/dashboard`, `/uploads`, `/settings/billing`, `/billing/success`)는 `/login`으로 리다이렉트된다(`src/middleware.ts`).

## 0. 사전 준비

```bash
node -v            # 20+ 권장 (Next.js 15)
npm install
npm i -g supabase   # Supabase CLI (또는 npx supabase 사용)
```

계정: [Supabase](https://supabase.com), [Anthropic](https://console.anthropic.com), [Polar](https://polar.sh).

## 1. `.env` 키 개요

실제 요구되는 키는 `src/lib/env.ts`의 zod 스키마가 기준이다(누락 시 서버 시작/요청 시점에 검증 에러가 난다).

| 키 | 출처 | 비밀 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 아니오 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon(publishable) 키 | 아니오 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 키 (webhook·RPC 전용) | **예** |
| `ANTHROPIC_API_KEY` | Anthropic API 키 | **예** |
| `POLAR_ACCESS_TOKEN` | Polar 액세스 토큰 | **예** |
| `POLAR_WEBHOOK_SECRET` | Polar 웹훅 서명 시크릿 | **예** |
| `POLAR_PRO_PRODUCT_ID` | Polar Pro 제품(recurring) ID | 아니오 |
| `POLAR_SERVER` | `sandbox` 또는 `production` | 아니오 |
| `SUCCESS_URL` | 결제 성공 후 이동할 앱 URL (`<앱 URL>/billing/success`) | 아니오 |

`NEXT_PUBLIC_` 접두사는 클라이언트로 노출된다 — **비밀키에 절대 붙이지 마라**. 시작은 `.env.example`을 `.env`로 복사.

## 2. Supabase (DB + 인증 + Storage)

### 2-1. `[수동]` 프로젝트 생성 + 키 복사

1. Supabase 콘솔 → **New project** 생성.
2. **Project Settings → API**에서:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (비공개 보관, 대시보드에서만 발급되며 MCP로는 조회 불가)

### 2-2. 마이그레이션 적용 (스키마 + RLS + RPC + Storage 버킷)

마이그레이션은 `supabase/migrations/`에 3개 파일로 있다:

- `..._initial_schema.sql` — `profiles`/`accounts`/`uploaded_statements`/`upload_usage`/`transactions` 테이블, 전 테이블 RLS, `has_locked_history`/`create_statement_upload`/`finalize_statement` RPC
- `..._harden_handle_new_user.sql` — 가입 트리거 함수의 불필요한 public RPC 노출 차단
- `..._create_statements_bucket.sql` — CSV 원본 저장용 private 버킷(`statements`, 5MB 제한) 생성

적용:

```bash
supabase login                                   # [수동] 브라우저 인증
supabase link --project-ref <YOUR_PROJECT_REF>   # 콘솔 URL의 ref
supabase db push                                 # 위 3개 마이그레이션 순서대로 적용
```

대안(CLI 없이): 콘솔 **SQL Editor**에 세 파일 내용을 순서대로 붙여넣어 실행.

> 적용 후 **Database → Advisors**에서 `authenticated_security_definer_function_executable`(`has_locked_history` WARN)과 `auth_leaked_password_protection` 경고가 뜰 수 있다. 전자는 의도된 설계(RLS 우회 필요), 후자는 **Authentication → Providers → Email → Leaked password protection**을 켜면 해소된다(운영 배포 전 권장).

### 2-3. `[수동]` Auth URL 설정 (이메일 인증 콜백)

finsight는 **이메일 + 비밀번호**와 **Google OAuth**(ADR-010) 두 가지 인증 방식을 쓴다. 가입 확인 메일, 비밀번호 재설정 메일, Google OAuth 콜백 모두 `${origin}/auth/callback`으로 리다이렉트되므로, Supabase가 이 URL을 허용 목록에 갖고 있어야 한다.

**Authentication → URL Configuration**:
- `Site URL`: `http://localhost:3000` (배포 시 실제 도메인으로 갱신)
- `Redirect URLs`에 추가:
  ```
  http://localhost:3000/**
  https://<your-domain>/**
  ```

> 앱의 콜백 라우트는 `src/app/(auth)/auth/callback/route.ts` (`/auth/callback`)다. `exchangeCodeForSession`이 이메일 확인/비밀번호 재설정/Google OAuth code를 provider 구분 없이 동일하게 처리한다 → `/dashboard`(또는 `?next=`로 지정된 경로, 비밀번호 재설정은 `/reset-password`).

> **로컬 개발 시 이메일 전송량 주의**: Supabase 기본 내장 SMTP는 시간당 발송량이 제한돼 있다(계정 확인/비밀번호 재설정 메일 다수 테스트 시 막힐 수 있음). 반복 테스트가 많다면 **Authentication → Providers → Email**에서 커스텀 SMTP를 연결하거나, 콘솔 **Authentication → Users**에서 테스트 유저를 수동으로 confirm 처리한다.

### 2-4. `[수동]` Google OAuth Provider 설정

1. Supabase 콘솔 **Authentication → Providers → Google**을 열어 `Enable` 토글을 켠다 — 이 페이지에 이 프로젝트 전용 **Callback URL**(`https://<project-ref>.supabase.co/auth/v1/callback`)이 표시된다.
2. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type: `Web application`.
3. **Authorized redirect URIs**에 1번에서 확인한 Supabase Callback URL을 그대로 붙여넣는다(앱 자체 URL이 아님).
4. 발급된 **Client ID**/**Client secret**을 1번 Supabase Google Provider 설정 화면에 입력하고 저장한다.

> 앱의 `.env`에는 Google Client ID/Secret을 별도로 넣지 않는다 — Supabase가 OAuth 흐름 전체(리다이렉트, code exchange, 세션 발급)를 대행하므로 클라이언트는 `supabase.auth.signInWithOAuth({ provider: 'google' })` 호출만 하면 된다.

## 3. Anthropic

`[수동]` [console.anthropic.com](https://console.anthropic.com)에서 API 키 발급 → `ANTHROPIC_API_KEY`. CSV 컬럼 매핑(헤더+샘플 최대 20행)과 카테고리 분류(100행 배치)에만 쓰인다 — 원문 CSV 전체나 실제 금액/부호 변환은 결정론적 코드에서 처리하므로 과금은 이 두 단계에 국한된다.

## 4. Polar (결제)

### 4-1. `[수동]` 제품 + 토큰

> 샌드박스는 프로덕션과 **계정·조직이 분리**돼 있다. 결제 흐름은 **샌드박스**에서 검증하라 — `.env`에 `POLAR_SERVER=sandbox`가 기본값이고, `src/lib/polar/client.ts`가 이 값으로 서버를 분기한다.

1. **https://sandbox.polar.sh** 로그인 → 조직 생성 → **Products**에서 Pro 단일 recurring 제품 생성 → 제품 ID → `POLAR_PRO_PRODUCT_ID`.
2. **Settings → API Tokens**에서 액세스 토큰 발급(checkout 생성·구독 조회 권한) → `POLAR_ACCESS_TOKEN`.

### 4-2. `[수동]` 웹훅 등록

웹훅은 공개 URL이 필요하므로 로컬은 터널을 띄운다:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000   # https://xxxx.trycloudflare.com 발급
```

1. Polar **Settings → Webhooks → Add endpoint**:
   ```
   https://<공개-도메인>/api/webhooks/polar
   ```
   (로컬은 위 `trycloudflare.com` URL, 배포는 Vercel 도메인). 경로는 정확히 `/api/webhooks/polar`(복수형 `webhooks`)다.
2. 포맷은 **Raw**(Standard Webhooks) 선택 — `src/app/api/webhooks/polar/route.ts`가 `@polar-sh/nextjs`의 `Webhooks()` 핸들러로 서명을 검증한다.
3. 구독 관련 이벤트(`subscription.*`)를 모두 선택한다 — 핸들러(`src/services/subscriptionService.ts`)가 `payload.type`이 `subscription.`으로 시작하는 이벤트를 전부 처리한다.
4. 서명 **secret** → `POLAR_WEBHOOK_SECRET`.

### 4-3. `SUCCESS_URL` 설정

체크아웃 성공 시 이동할 URL(`src/app/api/checkout/route.ts`)이다. 로컬은 `http://localhost:3000/billing/success`, 배포는 실제 도메인의 동일 경로로 설정한다. 이 페이지(`src/app/(dashboard)/billing/success/page.tsx`)가 구독 상태를 2초 간격으로 폴링하다가 Pro 반영되면 `/dashboard`로 이동한다.

### 4-4. 샌드박스 결제 테스트

체크아웃 결제는 Stripe 테스트 모드다 — 카드 `4242 4242 4242 4242` / 미래 만료일 아무거나 / CVC 아무거나.

## 5. 로컬 실행 + 검증

`.env`를 모두 채운 뒤:

```bash
npm run dev
```

수동 체크:
1. `http://localhost:3000/` — 랜딩 렌더 확인.
2. `/login` → 이메일/비밀번호로 회원가입 → 인증 메일 확인 → 링크 클릭 → `/dashboard` 진입.
3. `/uploads`에서 CSV 업로드 → 처리 완료 후 `/dashboard`에서 카테고리별 지출·월별 추이 확인.
4. `/settings/billing`에서 Pro 업그레이드 → Polar 체크아웃(샌드박스 결제) → `/billing/success` 폴링 → Pro 반영 확인.

Free/Pro 게이팅은 **서버 DB(`profiles.plan`)로만** 판정되며, 이 필드는 검증된 Polar webhook(service_role) 코드만 갱신한다(다른 라우트나 클라이언트는 직접 수정하지 않음).

## 6. 배포 (Vercel)

핵심 구현이 끝난 뒤 연결하는 단계다(`CLAUDE.md` 참고).

1. Vercel 프로젝트에 1절의 `.env` 값을 **Environment Variables**로 등록(`NEXT_PUBLIC_*`는 공개, 나머지는 비공개).
2. Supabase **Site URL**·**Redirect URLs**, Polar 웹훅 엔드포인트, `SUCCESS_URL`을 모두 배포 도메인으로 갱신.
3. CSV 파싱을 트리거하는 라우트(`api/statements/[id]/complete-upload`, `api/statements/[id]/retry`)는 Claude 호출 지연에 대비해 `maxDuration = 300`이 설정돼 있다.
4. 배포 전 `supabase db push`로 마이그레이션이 적용돼 있어야 한다(프로덕션은 dev와 별도 Supabase 프로젝트 사용을 권장).

## 7. 트러블슈팅

- **`... is required` 형태의 zod 검증 에러**: `.env`의 필수 키가 비어 있을 때 해당 기능 호출 경로에서 발생(`src/lib/env.ts`). 공개 페이지는 미설정이어도 렌더되지만, 인증·업로드·결제를 쓰려면 해당 키가 필요하다.
- **가입/로그인 후 리다이렉트 실패**: Supabase **Authentication → URL Configuration**의 `Redirect URLs`에 `http://localhost:3000/**`(또는 배포 도메인)가 등록됐는지 확인.
- **인증 메일이 안 옴**: Supabase 기본 SMTP 발송량 제한. 콘솔 **Authentication → Users**에서 해당 유저를 수동 confirm 하거나 커스텀 SMTP 연결.
- **웹훅이 구독을 갱신 안 함**: 서명 secret 일치 여부, 엔드포인트가 정확히 `/api/webhooks/polar`로 끝나는지(끝 슬래시·오타 시 리다이렉트로 Polar가 실패 처리), `subscription.*` 이벤트가 선택됐는지 확인.
- **CSV 업로드 후 상태가 `failed`로 멈춤**: `ANTHROPIC_API_KEY` 누락/한도 또는 일시적 provider 오류. `uploaded_statements.error_message`/`failure_code`를 확인하고 `/uploads`에서 재시도(최대 시도 횟수 제한 있음).
- **대시보드가 회원가입 직후 500**: Supabase Auth↔PostgREST 사이 clock skew로 `PGRST303`이 뜨는 알려진 케이스. `src/lib/supabase/retry.ts`의 `withClockSkewRetry`가 자동으로 1회 재시도한다 — 지속되면 새로고침.
