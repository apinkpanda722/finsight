# Step 1: report-access-service-and-route

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `phases/pdf-report-export/index.json` — step 0에서 만든 `buildCategoryReportPdf` 시그니처, `CATEGORY_LABELS`가 옮겨진 위치(summary 참고)
- `/docs/ADR.md` — ADR-012(Pro 게이팅 대상, 리포트 내용 재사용 원칙)
- `src/services/reportPdfService.ts`(step 0 산출물) — `buildCategoryReportPdf(input: ReportSummaryInput)` 시그니처를 정확히 확인하고 그대로 호출한다.
- `src/app/(dashboard)/dashboard/page.tsx` — 이 route가 재사용해야 할 데이터 조회 패턴: `requireUserId()`, `withClockSkewRetry(() => supabase.from("profiles").select("plan")...)`로 plan 조회, `transactions` 테이블에서 `amount, category, transaction_date` select(정렬/필터 없이 전체), `summarizeByCategory`/`summarizeByMonth`/`getMonthKey` 호출 순서. **RLS-scoped 클라이언트만 쓴다** — 본인 데이터만 읽으므로 service role이 필요 없다(대시보드 페이지와 동일).
- `src/services/subscriptionService.ts`(1~12행 부근) — `type XxxDeps = { supabase: SupabaseClient<Database> }` deps injection 패턴과 커스텀 Error 클래스(`NoSubscriptionError`, `readonly code = "..."`) 패턴.
- `src/app/api/statements/[id]/route.ts` — 얇은 route handler 패턴: `requireUserId()`/`UnauthorizedError`를 401로, 도메인 에러를 적절한 status로 매핑하는 헬퍼 구조. 이 파일의 `authenticatedUserId()` 같은 헬퍼를 그대로 복붙하지 말고 필요한 만큼만 참고해서 이번 route에 맞게 작성한다.
- `src/lib/api/auth.ts` — `requireUserId()`, `UnauthorizedError`
- `src/lib/api/response.ts` — `apiError(code: ApiErrorCode, message, status)`
- `src/types/domain.ts` — `ApiErrorCode`에 이미 `"forbidden"`이 있다(1~8행). 새 코드를 추가할 필요 없다.
- `src/lib/supabase/server.ts` — `createClient()`(RLS-scoped), `src/lib/supabase/retry.ts`의 `withClockSkewRetry`
- `next.config.ts` — 현재 `serverExternalPackages: ["pdfjs-dist"]`만 있다.

## 작업

1. **`src/services/reportService.ts`** 신규 생성:
   ```ts
   type ReportServiceDeps = { supabase: SupabaseClient<Database> }

   export class ReportAccessError extends Error {
     readonly code = "forbidden" as const
     // Free 사용자가 요청했을 때 던진다
   }

   export async function generateCategoryReportPdf(
     userId: string,
     deps: ReportServiceDeps
   ): Promise<Buffer>
   ```
   내부에서: `withClockSkewRetry`로 `profiles.plan` 조회(dashboard/page.tsx와 동일 패턴) → `"pro"`가 아니면 `ReportAccessError` throw → `withClockSkewRetry`로 `transactions`(amount, category, transaction_date) 전체 조회 → `summarizeByCategory`/`summarizeByMonth`(dashboardInsightService) → `getMonthKey()`로 `currentMonth` 계산 → `buildCategoryReportPdf({ categories, monthly, currentMonth, generatedAt: new Date() })` 호출 후 반환. Supabase 쿼리 에러(profileResult.error/transactionsResult.error)는 일반 `Error`로 던져 route에서 500 처리한다.
2. **`src/app/api/reports/category-pdf/route.ts`** 신규 생성 (`GET`, 얇게 유지):
   - `requireUserId()` → `UnauthorizedError` catch → `apiError("unauthorized", "로그인이 필요합니다.", 401)`
   - `createClient()`(RLS-scoped)로 `generateCategoryReportPdf(userId, { supabase })` 호출
   - `ReportAccessError` catch → `apiError("forbidden", "Pro 사용자만 이용할 수 있는 기능입니다.", 403)`
   - 그 외 에러 catch → `apiError("internal_error", "리포트를 생성할 수 없습니다.", 500)`
   - 성공 시 `new NextResponse(buffer, { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": \`attachment; filename="finsight-report-${currentMonth}.pdf"\` } })` — 파일명에 `currentMonth`(예: `2026-08`)를 포함시킨다. 서비스가 Buffer만 반환하므로 route에서 파일명용 월 문자열이 필요하면 서비스 반환 타입에 `{ buffer: Buffer; month: string }`처럼 최소한만 확장해도 된다(재량).
3. **폰트 파일이 실제로 Vercel Function 번들에 포함되는지 검증**(ADR-012 addendum이 해결하려던 문제가 배포 시 실제로 작동하는지 확인하는 단계): `npm run build` 후 `.next/server/app/api/reports/category-pdf/route.js.nft.json`을 열어 `src/assets/fonts/NanumGothic-Regular.ttf` 경로가 트레이싱 목록에 포함되어 있는지 확인한다(`fs.readFileSync(path.join(process.cwd(), ...))`처럼 정적으로 분석 가능한 경로면 Next.js의 자동 file tracing이 보통 알아서 포함시킨다). **포함되어 있지 않다면**, `next.config.ts`에 `outputFileTracingIncludes: { "/api/reports/category-pdf/route": ["./src/assets/fonts/**"] }`를 추가하고 다시 빌드해서 재확인한다. 이 검증을 건너뛰지 마라 — 로컬에서는 파일시스템에 폰트가 그냥 있으니 항상 성공하는 것처럼 보이지만, Vercel 배포본(ADR-009: 아직 미배포)에서는 트레이싱에서 빠지면 런타임에 조용히 파일을 못 찾는다.

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `.next/server/app/api/reports/category-pdf/route.js.nft.json` grep으로 폰트 파일 트레이싱을 확인한다(위 3번 작업 참고).
3. `src/services/reportService.test.ts`: `plan: "free"`일 때 `ReportAccessError`가 던져지는지, `plan: "pro"`일 때 Buffer가 반환되는지(빌더를 실제로 호출해도 되고, 필요하면 `buildCategoryReportPdf`를 모킹해도 된다 — 재량), 트랜잭션이 0건일 때도 에러 없이 진행되는지 확인한다.
4. `src/app/api/reports/category-pdf/route.test.ts`: 인증 없음 → 401, Free 사용자 → 403, Pro 사용자 → 200 + `Content-Type: application/pdf` 헤더 확인. `src/app/api/statements/init-upload/route.test.ts`의 모킹 스타일을 참고한다.
5. 아키텍처 체크리스트:
   - route handler가 얇게 유지됐는가(로직은 `reportService.ts`에 있는가)?
   - CLAUDE.md CRITICAL 규칙 위반 없는가? (읽기 전용 라우트이므로 `profiles`/구독 스냅샷 필드에 대한 쓰기가 없어야 한다)
6. 결과에 따라 `phases/pdf-report-export/index.json`의 step 1을 업데이트한다.

## 금지사항

- UI/버튼을 만들지 마라 — step 2 범위다.
- `src/services/reportPdfService.ts`(step 0 산출물)의 PDF 렌더링/폰트 임베딩 로직을 다시 건드리지 마라 — 이 step은 그걸 호출하는 인증/데이터 레이어만 다룬다.
- `createServiceRoleClient()`를 쓰지 마라 — 본인 소유 데이터만 다루므로 RLS-scoped `createClient()`로 충분하다.
- `profiles`나 구독 스냅샷 필드에 대한 UPDATE를 추가하지 마라 — 이 라우트는 순수 읽기 전용이다(CLAUDE.md CRITICAL: 해당 필드는 검증된 Polar webhook 코드에서만 갱신).
- 폰트 파일 트레이싱 확인(작업 3번)을 생략하지 마라 — "로컬에서 되니까 됐다"고 넘기지 마라.
