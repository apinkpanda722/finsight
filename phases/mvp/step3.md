# Step 3: landing-dashboard-shell

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/PRD.md` (요금제, 디자인 섹션)
- `.claude/skills/finsight-design-system/references/prototype/auth-screens.jsx`의 `Landing()`, `dashboard-screens.jsx`의 `Sidebar()`/`PlanBadge()` (레이아웃 참조 — `finsight-design-system` 스킬 참고)
- step 2에서 만들어진 `src/middleware.ts`, `src/lib/supabase/server.ts`, `src/app/(auth)/**`

## 작업

이 step은 랜딩 페이지와 대시보드 셸(껍데기)만 만든다. 실제 업로드/결제 기능은 없다 — 이후 step이 채운다. 디자인은 `finsight-design-system` 스킬(`.claude/skills/finsight-design-system/`)을 따른다 — inline style을 그대로 복붙하지 말고 Tailwind+shadcn(step 0에서 설정한 pill 버튼, 색상/폰트 토큰)으로 옮긴다.

### 1. 랜딩 페이지

`src/app/(marketing)/page.tsx`: `auth-screens.jsx`의 `Landing()` 레이아웃을 참고한다 — 다크 히어로(`--color-surface-dark`) 배경에 회전된 floating `ProductCard` 2장(이번 달 지출/카테고리 미리보기), 헤드라인("지출을 있는 그대로, 이해하기 쉽게." 톤의 sentence-case 문구), 기능 3열 그리드, Free/Pro 요금제 2열 비교(PRD.md 참고: Free는 계좌 1개+최근 3개월, Pro는 다중 계좌+무제한 히스토리), 하단 다크 밴드 CTA, Footer. "무료로 시작하기" CTA(`/login`으로 연결, 로그인 페이지에 회원가입 폼도 있다).

### 2. 대시보드 셸

`src/app/(dashboard)/layout.tsx`: `dashboard-screens.jsx`의 `Sidebar()`/`PlanBadge()` 참고 — 220px 고정 폭 사이드바(개요/명세서 관리/요금제 네비게이션 항목, Dashboard/Uploads/Settings/Billing 링크는 만들되 `/uploads`, `/settings/billing` 페이지 자체는 이후 step(5, 4)이 구현한다), 상단에 워드마크+plan 배지(pill, "Free"는 중립색/"Pro"는 primary 배경 — Server Component에서 `profiles.plan`을 조회해 표시), 로그아웃 버튼(`supabase.auth.signOut()` 후 `/`로 이동).

`src/app/(dashboard)/dashboard/page.tsx`: 지금은 실제 거래 데이터가 없으므로 빈 상태 UI만 구현한다 — "아직 업로드한 명세서가 없어요. 첫 CSV를 업로드해보세요" 안내와 `/uploads`로 가는 버튼.

### 3. 네비게이션 플로우 확인

랜딩(`/`) → CTA 클릭 → `/login`(가입 탭) → 가입 후 이메일 확인 안내 → 이메일 확인 → `/auth/callback` → `/dashboard`(빈 상태) 흐름이 끊기지 않고 이어지는지 확인한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm test
```

## 검증 절차

1. 위 AC를 실행한다.
2. plan 배지 컴포넌트에 대한 단위 테스트(예: plan='free'/'pro'에 따라 다른 텍스트 렌더링)가 구현보다 먼저 작성됐는지 확인한다.
3. `.env`의 Supabase/Anthropic/Polar 키는 아직 실제 값이 아니라 자리표시자(mock, `...-REPLACE-BEFORE-REAL-USE`)다. 실제 회원가입/로그인 E2E(테스트 계정으로 랜딩→로그인→대시보드 이동)는 지금 시도하지 마라 — 실제 API 키가 없어 401로 실패하는 게 정상이며, 이를 이유로 `blocked` 처리하지 마라. 이 step은 AC(lint/build/test)와 코드 리뷰 수준으로만 검증하고, 실제 E2E 확인은 실제 키가 채워진 뒤 별도로 진행한다.
4. 결과에 따라 `phases/mvp/index.json`의 step 3 항목을 업데이트한다.

## 금지사항

- `/settings/billing`, `/uploads` 페이지의 실제 내용을 구현하지 마라 — 링크만 만들고 내용은 각각 step 4, step 5의 범위다.
- 대시보드에 가짜(mock) 거래 데이터를 하드코딩하지 마라 — 이유: 빈 상태 UI가 이 step의 목표이며, 실 데이터 연동은 step 7이다.
- `shadcn/ui` 외 새로운 UI 라이브러리를 추가하지 마라.
- 기존 테스트를 깨뜨리지 마라.
