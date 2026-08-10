---
name: finsight-design-system
description: finsight(개인 가계부 SaaS)의 확정된 비주얼 디자인 시스템 — 색상/타이포/간격/radius 토큰과 실제 화면 프로토타입(랜딩, 가입/로그인/이메일인증/비밀번호 재설정, 대시보드 개요, 계좌 칩, 카테고리 지출 바, 월별 추이+Free 잠금 UI, 명세서 목록, 요금제, 결제 모달, 업로드 모달). 이 프로젝트에서 랜딩 페이지, 대시보드, 인증 화면, 업로드 플로우, 결제/요금제 UI, 또는 아무 shadcn/ui 컴포넌트나 Tailwind 스타일링 작업을 하기 전에 반드시 사용하라. "버튼 만들어줘", "이 페이지 스타일링해줘", "색상 뭐 쓸까" 같은 사소해 보이는 요청에도 적용된다 — 디자인 토큰을 임의로 고르거나 shadcn 기본값을 그대로 쓰면 이 시스템과 어긋난다.
---

# finsight 디자인 시스템

## 왜 이게 필요한가

finsight의 시각 디자인은 이미 Claude Design으로 확정됐고 이 스킬 폴더 안에 토큰과 화면 프로토타입으로 저장돼 있다. 이 스킬 없이 UI를 만들면 shadcn/ui 기본 팔레트·radius·폰트를 그대로 쓰게 되는데, 그러면 나중에 전부 다시 손봐야 한다. 새 화면이든 기존 화면 수정이든, 항상 아래 소스를 먼저 확인하고 시작하라. 아래 경로는 전부 이 SKILL.md 파일 기준 상대 경로다.

## 소스 오브 트루스

| 파일 | 용도 |
|---|---|
| `/docs/DESIGN.md` | 디자인 철학·톤·보이스 요약 (프로젝트 docs에 있는 사람이 읽는 개요 — 아래 규칙은 이 문서의 발췌본) |
| `references/tokens/*.css` | 실제 CSS 커스텀 프로퍼티 값 (색상/타이포/간격/radius/폰트) |
| `references/design-tokens-manifest.json` | 모든 토큰 이름·값·종류의 구조화된 목록 (빠르게 grep할 때 유용) |
| `references/prototype/*.jsx`, `mock-data.js`, `charts.js` | 실제 화면 레이아웃·컴포지션·인터랙션의 동작하는 참조 구현 |
| `assets/*.html` | 브라우저로 바로 열어볼 수 있는 시각적 결과물 (`style-exploration.html`, `screens-overview.html`, `prototype.html`) — 사람이 눈으로 확인할 때만 필요, Claude가 매번 읽을 필요는 없다 |

**중요**: `prototype/*.jsx`는 순수 React + inline style + 임시 `window.FinsightDesignSystem_c404e7` 네임스페이스로 만들어진 프로토타입이다. 실제 코드베이스(Next.js 15 + TypeScript + Tailwind + shadcn/ui)에 이 inline style을 그대로 복붙하지 마라 — **레이아웃·구성·인터랙션 패턴만 참고**하고, 실제 구현은 Tailwind 클래스 + shadcn 컴포넌트 + 아래 CSS 변수 매핑으로 새로 짠다.

## 절대 어기면 안 되는 규칙 (README.md 발췌)

- **버튼/인풋/검색창은 전부 pill 모양**(`--radius-pill: 100px`). 카드는 `--radius-xl(24px)`, 아이콘 플레이트는 `--radius-full`. 인터랙티브 요소에 각진 모서리를 쓰지 마라.
- **악센트 컬러는 딱 하나, Deep Azure(`--color-primary: #1C4ED8`)뿐이고 아주 아껴 쓴다** — 주 CTA 버튼과 워드마크에만. 나머지는 거의 무채색(흰 캔버스 + ink 텍스트).
- **숫자(가격, 퍼센트, 금액)는 항상 JetBrains Mono**(`--font-mono`), 절대 다른 폰트로 스타일링하지 마라. 그 외 모든 텍스트는 Inter.
- **문장은 항상 sentence case.** 헤드라인·버튼·nav 라벨 전부. 뱃지 안의 eyebrow 텍스트를 제외하고 ALL CAPS 쓰지 마라.
- **이모지 금지.**
- **아이콘/일러스트/사진 없음.** 그라디언트도, 텍스처도 없다. 순수 flat color만. `AssetRow` 같은 "아이콘"은 원형 플레이트 위 두 글자 모노그램이지 실제 아이콘 글리프가 아니다.
- **거의 flat한 elevation.** 라이트 카드엔 1px hairline border(`--color-hairline`)만, hover/floating 상태에만 `--shadow-soft` 하나. 다크 히어로 위 "product-UI" 카드만 더 깊은 그림자로 "떠 있는" 느낌을 준다.
- **빨강/초록(`--color-semantic-up/down`)은 거래 신호 텍스트 색상 전용**이지 버튼 배경으로 쓰지 않는다.
- 톤은 차분하고 단정적("Markets, understood." 같은 예시). 느낌표·긴급성 문구("지금 바로", "놓치지 마세요") 금지.

### 예외: 랜딩 페이지 "명세서 분석" 하이라이트 섹션

랜딩 페이지의 `StatementHighlight` 컴포넌트(raw CSV vs 정리된 결과 비교, `src/components/marketing/statement-highlight.tsx`)에 한해서만 아래를 허용한다. 이 예외는 **랜딩 페이지 전용**이며 대시보드·인증 등 실제 제품 화면에는 적용하지 않는다.

- 강조 카드 하나에만 `--shadow-glow-primary`(Deep Azure 링 + soft glow, `globals.css`) 사용 가능. 여전히 악센트는 Deep Azure 하나뿐이다 — 새 색을 추가하지 않는다.
- 글로우 카드 안 큰 금액 텍스트는 대비 문제로 Deep Azure가 아니라 흰색(`--color-on-dark`)을 쓴다.
- 이 섹션은 실제로 구현된 값(`summarizeByCategory`/`summarizeByMonth`)만 보여준다. "이상 거래", "구독 누수" 등 이 MVP에 없는 기능은 문구로도 언급하지 않는다 — 이를 지키는 가드 테스트가 `sample-preview.test.tsx`/`statement-highlight.test.tsx`에 있다.

## Tailwind / shadcn 매핑

shadcn의 CSS 변수 컨벤션(`--primary`, `--radius`, `--background` 등)을 `references/tokens/*.css`의 값으로 덮어써서 `globals.css`(또는 shadcn theme 설정)에 반영한다. 하드코딩된 hex/px 값을 컴포넌트에 직접 쓰지 마라 — 항상 변수를 통해서 쓴다.

| shadcn/Tailwind 변수 | finsight 토큰 |
|---|---|
| `--primary` | `--color-primary` (#1C4ED8) |
| `--primary-foreground` | `--color-on-primary` (#FFFFFF) |
| `--background` | `--color-canvas` (#FFFFFF) |
| `--foreground` | `--color-ink` (#0E1013) |
| `--muted-foreground` | `--color-body` / `--color-muted` |
| `--border` | `--color-hairline` |
| `--radius` | 컴포넌트별로 다름 — 버튼/인풋은 `--radius-pill`, 카드는 `--radius-xl`. shadcn의 단일 `--radius` 변수 하나로 퉁치지 말고, 버튼/인풋 컴포넌트에는 `rounded-full`(pill), 카드류에는 `rounded-[24px]` 또는 그에 준하는 Tailwind 유틸을 명시적으로 쓴다. |
| `font-sans` | Inter (`--font-display`/`--font-body`) |
| 숫자/가격 표시 클래스 | JetBrains Mono (`--font-mono`) — 별도 유틸 클래스(예: `font-mono tabular-nums`)를 만들어 금액/퍼센트 렌더링에만 일관되게 적용 |
| dark hero 섹션 배경 | `--color-surface-dark` (#0E1013) / elevated `--color-surface-dark-elevated` |

폰트는 Google Fonts에서 Inter + JetBrains Mono를 가져온다(`tokens/fonts.css` 참고) — Next.js라면 `next/font/google`로 최적화해서 로드하는 걸 권장한다.

## 화면별 참조 매핑

작업 중인 실제 화면이 아래 목록에 있으면, 코드를 새로 지어내지 말고 **먼저 `references/prototype/`의 해당 함수를 열어서 레이아웃/구성 순서/상태 전이를 확인**한 뒤 Tailwind+shadcn으로 옮긴다.

| 실제 화면 (harness step) | prototype 참조 (`references/prototype/` 기준) |
|---|---|
| 랜딩 페이지 (`(marketing)/page.tsx`) | `auth-screens.jsx`의 `Landing()` — 다크 히어로 + floating ProductCard, 기능 3열 그리드, 요금제 2열, 하단 CTA, Footer. 히어로 바로 아래 `StatementHighlight`(raw CSV vs 정리된 결과, 글로우 카드)는 prototype에 없는 랜딩 전용 신규 섹션 — 위 "예외" 항목 참고 |
| 회원가입 (`/login` 가입 폼) | `auth-screens.jsx`의 `Signup()` |
| 이메일 확인 대기 | `auth-screens.jsx`의 `VerifyEmail()` |
| 로그인 (`/login`) | `auth-screens.jsx`의 `Login()` — `justVerified` 배너 패턴 포함 |
| 비밀번호 찾기/재설정 | `auth-screens.jsx`의 `ForgotPassword()`, `ResetPassword()` |
| 대시보드 개요 (`(dashboard)/dashboard/page.tsx`) | `dashboard-screens.jsx`의 `Overview()` — `AccountChips`(Free는 잠긴 계좌에 🔒), `CategoryBar`, `MonthlyTrend`(Free 3개월 잠금 배너+잠긴 막대) |
| 사이드바/셸 | `dashboard-screens.jsx`의 `Sidebar()`, `PlanBadge()` |
| 명세서 목록 (`(dashboard)/uploads/page.tsx`) | `dashboard-screens.jsx`의 `Statements()`, `StatementRow()`, `StatusBadge()`, `ConfirmDelete()`(인라인 확인, 별도 다이얼로그 아님) |
| 업로드 모달 | `dashboard-screens.jsx`의 `UploadModal()` — select→uploading(진행률바)→pending→processing→completed/failed 상태 전이, `ConsentCheckbox`(Supabase/Anthropic 전달 동의) 패턴 그대로 따른다 |
| 요금제/청구 (`(dashboard)/settings/billing/page.tsx`) | `dashboard-screens.jsx`의 `Billing()` — Free(라이트 카드)/Pro(다크 카드) 대비 |
| 결제 모달/체크아웃 | `dashboard-screens.jsx`의 `CheckoutModal()` — 단, 실제 구현은 Polar 호스팅 체크아웃으로 리다이렉트하므로 이 모달은 "체크아웃 진입 전 짧은 확인 UI"가 필요할 때만 참고 |

`references/prototype/mock-data.js`에는 실제 대시보드 집계 로직(카테고리/월별 합계 등)을 어떻게 화면에 뿌리는지 보여주는 mock 데이터 구조가 있다 — 실제 Supabase 쿼리 결과를 이 화면들에 바인딩할 때 필드 이름/형태를 참고하되, 실제 데이터 소스(RLS로 필터된 `transactions`)는 harness step 7(`dashboard-insights`)의 설계를 따른다.
