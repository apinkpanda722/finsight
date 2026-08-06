# 프로젝트: Finsight

## 기술 스택
- Next.js 15 (App Router, 메이저 버전 고정 — 16의 `proxy.ts` 전환 회피), TypeScript strict
- Tailwind CSS + shadcn/ui
- Supabase (Auth + Postgres + Storage)
- Anthropic Claude API (`@anthropic-ai/sdk`, 모델: `claude-sonnet-5`)
- Polar (`@polar-sh/sdk`, `@polar-sh/nextjs`) — Pro 단일 recurring 상품, Free는 앱 내부 plan
- Vercel 배포 (핵심 구현 완료 후 연결 — `plan.md` ADR 참고)
- Vitest + React Testing Library

## 아키텍처 규칙
- CRITICAL: 서비스 함수(`src/services/*.ts`)는 Supabase/Anthropic 클라이언트를 인자로 주입받는다 (`deps: { supabase, anthropic }`). 내부에서 직접 `createServerClient()`나 `new Anthropic()`을 호출하지 않는다.
- CRITICAL: API route handler(`src/app/api/**/route.ts`)는 얇게 유지한다. 실제 로직은 서비스 함수로 위임한다.
- CRITICAL: 라우트 보호/세션 확인에 `getSession()`을 쓰지 않는다. `getClaims()` 또는 `getUser()`만 사용한다 — `getSession()`은 로컬 JWT만 검증하고 서버 측 무효화를 확인하지 않는다.
- CRITICAL: `profiles.plan`과 구독 스냅샷 필드(`subscription_status`, `polar_subscription_id`, `current_period_end`, `cancel_at_period_end`, `polar_modified_at`)는 검증된 Polar webhook 코드(service_role)에서만 갱신한다. 다른 라우트나 클라이언트가 직접 update하지 않는다.
- CRITICAL: `accounts`/`uploaded_statements`/`transactions`에 대한 쓰기는 반드시 `create_statement_upload`/`finalize_statement` RPC를 통해서만 한다. route handler에서 이 테이블에 직접 INSERT/UPDATE하지 않는다 — quota 검사, composite 소유권 검증, 재처리 멱등성은 RPC 트랜잭션 안에서만 보장된다.
- CRITICAL: Free 사용자의 과거(현재 달 포함 최근 3개 달 이전) 거래 존재 여부를 UI에 보여줄 때는 `has_locked_history()` RPC만 사용한다. 실제 거래를 조회해서 존재 여부를 판단하지 않는다.
- CRITICAL: Supabase Storage 경로에는 사용자가 업로드한 원본 `file_name`을 절대 쓰지 않는다. `{user_id}/{statement_id}` 컨벤션의 서버 생성 식별자만 사용한다.
- CRITICAL: CSV 원문, mapping/category 프롬프트, transaction description 배열, webhook payload 전체를 로그에 그대로 찍지 않는다. 로그에는 `statementId`, `userId`, `errorCode`, `stop_reason`, batch 번호만 남긴다.
- CRITICAL: transaction `description`/`file_name`/`error_message`는 신뢰할 수 없는 입력으로 취급한다. `dangerouslySetInnerHTML`을 쓰지 않고 JSX 텍스트 노드로만 렌더링한다.
- CRITICAL: Polar `checkout`/`portal` 라우트는 인증된 same-origin POST만 허용한다. product ID·customer ID를 body/query에서 받지 않고 항상 서버가 세션 사용자와 `POLAR_PRO_PRODUCT_ID`로 고정한다.
- CRITICAL: Claude에 CSV 전체를 한 번에 넘기지 않는다. 컬럼 매핑은 헤더+샘플 행(최대 20행)만, 카테고리 분류는 100행 단위 batch로만 호출한다. 실제 날짜/금액 변환과 부호 규칙은 결정론적 코드에서 수행한다.
- 컴포넌트는 `src/components/`, 타입은 `src/types/`, 외부 API 래퍼는 `src/lib/`, 도메인 로직은 `src/services/`에 분리한다.
- 사용자 소유 리소스를 참조하는 테이블 간에는 `(user_id, id)` unique + composite FK를 사용해 service_role 코드 버그로도 타 사용자 데이터가 연결될 수 없게 한다.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD). `.claude/hooks/tdd-guard.sh`가 `src/**/*.ts(x)` 수정 전 동일 이름 테스트 파일 존재를 강제한다. SDK 인스턴스화 전용 래퍼(`lib/{supabase,polar,anthropic}/*`)는 예외 — step 0에서 hook에 반영한다.
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트 (Vitest)
