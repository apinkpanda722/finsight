# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (특히 ADR-001: Next.js 15 고정 이유)
- `/.claude/hooks/tdd-guard.sh`

이 저장소는 현재 애플리케이션 코드가 없는 빈 상태다(`docs/`, `.claude/`, `phases/`, `scripts/`, `plan.md` 등 준비 문서만 있음). 이 step은 Next.js 프로젝트를 처음부터 스캐폴딩한다.

## 작업

### 1. Next.js 스캐폴딩 (버전 고정)

프로젝트 루트에는 이미 `docs/`, `.claude/`, `plan.md`, `phases/`, `scripts/`, `.env`, `.gitignore` 등 파일이 있어 `create-next-app`이 "디렉토리가 비어있지 않다"며 거부한다. 아래 순서로 우회하라:

1. 임시 디렉토리(예: `/tmp/finsight-scaffold`)에서 다음을 실행한다:
   ```bash
   npx --yes create-next-app@15 finsight-scaffold \
     --typescript --tailwind --eslint --app --src-dir \
     --import-alias "@/*" --turbopack --use-npm --disable-git --yes
   ```
2. 생성된 디렉토리에서 `node_modules`를 **제외**하고 프로젝트 루트로 복사한다: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `src/`, `public/`.
3. 프로젝트 루트에서 `npm install`을 실행해 `node_modules`를 새로 생성한다.
4. 임시 디렉토리를 삭제한다.
5. `tsconfig.json`에 `"strict": true`가 있는지 확인한다(기본값으로 켜져 있어야 함).

### 2. shadcn/ui 초기화

```bash
npx shadcn@latest init -y
npx shadcn@latest add button card input label form dialog badge alert skeleton
```

### 3. Vitest + React Testing Library

`vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`을 devDependency로 설치한다. `vitest.config.ts`(jsdom 환경, `src/test/setup.ts`를 setupFiles로 등록)와 `src/test/setup.ts`(`@testing-library/jest-dom` import)를 만든다. `package.json`의 `test` 스크립트를 `"vitest run"`으로 설정한다(watch 모드가 아닌 1회 실행 — CI/harness AC에서 종료 코드가 필요하다).

### 4. `lib/env.ts` (zod 환경변수 검증)

**TDD 순서를 지켜라 — 이 파일은 tdd-guard 예외가 아니다.** 먼저 `src/lib/env.test.ts`를 작성해 필수 변수가 없으면 파싱이 실패하고, 있으면 타입이 있는 객체를 반환하는지 검증한 뒤, `src/lib/env.ts`를 구현한다.

zod 스키마로 아래 변수를 서버 시작/빌드 시점에 검증하는 `env` 객체를 export한다(값이 비어 있거나 없으면 명확한 에러로 즉시 실패):

```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
ANTHROPIC_API_KEY, POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, POLAR_PRO_PRODUCT_ID,
POLAR_SERVER (z.enum(['sandbox','production'])), SUCCESS_URL (z.string().url())
```

### 5. `.env.example`

Git에 커밋되는 템플릿이다. 실제 값이 든 `.env`는 이미 `.gitignore`에 등록돼 있으니 건드리지 마라. `.env.example`에는 위 변수명만 값 없이(또는 `sandbox`처럼 민감하지 않은 기본값만) 나열한다.

### 6. TDD guard 예외 확정 반영

`.claude/hooks/tdd-guard.sh`의 `case "$file_path" in ... esac` 블록에 아래 세 경로를 **기존 항목(`src/components/ui/*`, `src/types/*`, `src/test/*`)에 추가**한다 — 순서를 바꾸거나 기존 항목을 지우지 마라:

```
*/src/lib/supabase/*|*/src/lib/polar/*|*/src/lib/anthropic/*|src/lib/supabase/*|src/lib/polar/*|src/lib/anthropic/*)
```

이 세 디렉토리는 이후 step에서 SDK 클라이언트를 인스턴스화만 하는 얇은 래퍼로 채워진다(비즈니스 로직 없음). `lib/csv/*`, `lib/api/*`, `lib/env.ts`는 예외에 포함하지 마라 — 실제 로직이 있어 test-first를 유지해야 한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm test
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행해 통과하는지 확인한다.
2. `npx shadcn@latest add ...`로 추가된 컴포넌트가 `src/components/ui/`에 있는지 확인한다.
3. `.claude/hooks/tdd-guard.sh`에 새 경로가 추가됐는지, 기존 예외/로직이 그대로인지 확인한다(`diff` 또는 `git diff`로 검토).
4. `src/lib/env.test.ts`가 `src/lib/env.ts`보다 먼저 작성됐는지(git 히스토리 또는 커밋 순서상) 확인한다.
5. 결과에 따라 `phases/mvp/index.json`의 step 0 항목을 업데이트한다.

## 금지사항

- `package.json`의 `private`, `license` 등 create-next-app 기본값 외 필드를 임의로 추가하지 마라 — 이유: 이후 step들이 기본 스캐폴딩을 전제로 작성됐다.
- 위에 나열한 shadcn 컴포넌트 외 다른 컴포넌트를 추가하지 마라 — 이유: 필요할 때 해당 기능을 구현하는 step에서 추가하는 게 원칙이다.
- `lib/supabase`, `lib/polar`, `lib/anthropic`, `services/`, `app/api/` 등 실제 기능 코드를 이 step에서 구현하지 마라 — 이유: 이후 step의 범위이며, 이 step은 스캐폴딩과 tdd-guard 설정만 다룬다.
- `tdd-guard.sh`의 기존 예외 항목(`src/components/ui/*`, `src/types/*`, `src/test/*`, `main.tsx`, `*.d.ts`)을 지우거나 순서를 바꾸지 마라 — 이유: 다른 step이 이 동작에 의존한다.
- `.env`(실제 값이 든 로컬 파일)를 읽거나 커밋하지 마라 — 이유: 민감한 값이 들어있고 이미 gitignore 처리돼 있다.
- 기존 테스트를 깨뜨리지 마라.
