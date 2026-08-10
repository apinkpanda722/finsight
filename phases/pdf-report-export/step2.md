# Step 2: report-download-ui

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `phases/pdf-report-export/index.json` — step 1에서 만든 라우트 경로(`GET /api/reports/category-pdf`)와 응답 형식(성공 시 `application/pdf` 바이너리, 실패 시 `{ error, message }` JSON + 401/403/500)을 정확히 확인한다.
- `src/components/dashboard/dashboard-insights.tsx` — `hasLockedHistory` 업셀 카드(309~325행 부근): `border border-border bg-background`, `<Button asChild><Link href="/settings/billing">Pro로 업그레이드</Link></Button>` 패턴. 이번 step의 Free 상태 UI는 이 톤을 그대로 따른다.
- `src/components/dashboard/plan-badge.tsx` — `export type Plan = "free" | "pro"`. 새 컴포넌트의 prop 타입으로 이걸 재사용한다(새로 만들지 마라).
- `src/app/(dashboard)/dashboard/page.tsx` — `DashboardInsights`에 `plan` prop을 넘기는 지점(이미 `profileResult.data?.plan === "pro" ? "pro" : "free"`로 계산되어 있다). 이번 step에서 만드는 버튼도 이 값을 그대로 받아쓴다.
- `src/components/dashboard/statement-upload-manager.tsx` — 인라인 에러 표시 패턴(`role="alert"`, 485행/591행 부근)을 참고한다. 이 프로젝트에는 toast 라이브러리가 없으므로 새로 추가하지 말고 인라인 텍스트로 처리한다.
- `src/components/dashboard/dashboard-insights.test.tsx` — 기존 컴포넌트 테스트(React Testing Library) 스타일 참고.
- `finsight-design-system` 스킬 — 버튼/카드/뱃지 톤 확인. 새 색상 토큰을 추가하지 말고 기존 토큰만 쓴다.

## 작업

1. **`src/components/dashboard/report-download-button.tsx`** 신규 생성:
   ```ts
   type ReportDownloadButtonProps = { plan: Plan }
   export function ReportDownloadButton({ plan }: ReportDownloadButtonProps)
   ```
   - `plan === "free"`: `hasLockedHistory` 카드와 동일한 톤의 안내 문구("PDF 리포트는 Pro 전용입니다" 등) + `/settings/billing`로 가는 업그레이드 CTA(`Button asChild` + `Link`). 실제 다운로드 로직은 없다.
   - `plan === "pro"`: 클릭 시 `fetch("/api/reports/category-pdf")` → 응답이 `ok`가 아니면 JSON을 파싱해 에러 메시지를 `role="alert"`로 인라인 표시(로딩/에러 state는 `useState`로 최소한만) → 성공하면 `response.blob()` → `URL.createObjectURL(blob)` → 임시 `<a>` 엘리먼트를 만들어 `download` 속성에 파일명을 지정하고 클릭 → `URL.revokeObjectURL`로 정리. 파일명은 응답의 `Content-Disposition` 헤더를 파싱하거나(재량), 없으면 `finsight-report.pdf`처럼 고정값을 써도 된다.
   - 버튼 클릭 중에는 `disabled` 처리해 중복 요청을 막는다.
2. 대시보드에 배치: `src/app/(dashboard)/dashboard/page.tsx`의 헤더(`<header className="mb-8">` 블록, "지출 인사이트" 제목이 있는 부분) 옆이나 `DashboardInsights` 컴포넌트 상단에 `<ReportDownloadButton plan={...} />`를 추가한다. 이미 계산되어 있는 `profileResult.data?.plan === "pro" ? "pro" : "free"` 값을 그대로 넘긴다(중복 계산하지 마라). 정확한 배치는 재량이되, 기존 레이아웃(그리드/카드 구조)을 깨지 않아야 한다.

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `src/components/dashboard/report-download-button.test.tsx`를 작성해:
   - `plan="free"`일 때 업그레이드 CTA가 렌더되고 `/settings/billing` 링크가 있는지
   - `plan="pro"`일 때 버튼이 렌더되고, 클릭 시 `fetch`가 `/api/reports/category-pdf`로 호출되는지(`fetch`를 mock)
   - `fetch`가 403/500을 반환할 때 에러 메시지가 화면에 나오는지
   를 확인한다. `URL.createObjectURL`/`revokeObjectURL`은 jsdom에 없을 수 있으니 필요하면 mock한다(기존 테스트 파일에 유사 mock이 있는지 먼저 확인).
3. 아키텍처 체크리스트:
   - 컴포넌트가 `Plan` 타입을 `plan-badge.tsx`에서 import했는가(중복 정의하지 않았는가)?
   - CLAUDE.md CRITICAL 규칙 위반 없는가? (다운로드 트리거만 하는 클라이언트 컴포넌트이므로 Supabase/Anthropic 직접 호출 없음)
4. `npm run dev`로 실제 대시보드를 열어 Pro/Free 두 상태에서 버튼이 의도대로 보이는지 눈으로 확인한다(계정 plan을 바꿔가며 확인하거나, 어렵다면 스토리/테스트 스냅샷으로 대체 확인).
5. 결과에 따라 `phases/pdf-report-export/index.json`의 step 2를 업데이트한다.

## 금지사항

- `src/app/api/reports/category-pdf/route.ts`(step 1 산출물)의 인증/게이팅/PDF 생성 로직을 건드리지 마라.
- 새 toast/알림 라이브러리를 추가하지 마라 — 인라인 에러 텍스트로 충분하다.
- `hasLockedHistory` 배너나 `MonthlyTrend`의 잠금 UI(`dashboard-insights.tsx`)를 리팩터링하지 마라 — 이번 step과 무관하다.
- `Plan` 타입을 새로 정의하지 마라 — `plan-badge.tsx`의 기존 타입을 import해서 쓴다.
