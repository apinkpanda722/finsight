# Step 3: dashboard-unified-view

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — "데이터 흐름" 마지막 줄("대시보드 갱신", 계좌별이 아님), "패턴" 섹션의 `accounts` 제거 규칙
- `/docs/ADR.md` ADR-011 — 모든 거래가 하나의 통합 뷰로 합쳐진다는 결정
- 이전 step들의 산출물(`phases/remove-accounts/index.json`) — step 0에서 `uploaded_statements.account_id` 컬럼 자체가 삭제됐다는 점이 중요하다(더 이상 계좌로 조인/필터할 컬럼이 없다)
- `src/app/(dashboard)/dashboard/page.tsx` 전체 — `accountsResult` 쿼리, `requestedAccountId`/`activeAccount` 로직, `transactions` 쿼리가 `uploaded_statements!inner(account_id)`로 조인해서 `activeAccount.id`로 필터링하는 부분, `EmptyDashboardCard`를 렌더하는 두 지점
- `src/components/dashboard/dashboard-insights.tsx` 전체 — `AccountChips` 컴포넌트(102~130행), `DashboardInsightsProps`의 `accounts`/`activeAccountId` 필드, `DashboardInsights` 함수 안에서 `<AccountChips accounts={accounts} activeAccountId={activeAccountId} />`를 렌더하는 부분(350~353행)
- `src/app/(dashboard)/dashboard/page.test.tsx`, `src/components/dashboard/dashboard-insights.test.tsx`(존재한다면) — 계좌 관련 기존 테스트 케이스

## 작업

대시보드를 "계좌 선택 → 그 계좌의 거래만" 구조에서 "로그인한 사용자의 전체 거래" 구조로 바꾼다.

1. **`dashboard/page.tsx`**:
   - `accountsResult` 쿼리(`supabase.from("accounts")...`)를 완전히 제거한다.
   - `searchParams`의 `account` 파라미터 처리, `requestedAccountId`, `activeAccount` 계산 로직을 제거한다. `DashboardPageProps`에서도 `account` 파라미터를 뺀다.
   - `transactions` 쿼리를 단순화한다 — 더 이상 `uploaded_statements!inner(account_id)`로 조인하거나 `account_id`로 필터할 필요가 없다(그 컬럼 자체가 없다). `transactions` 테이블에서 바로 `amount, category, transaction_date`를 조회하면 된다(RLS가 이미 `user_id` 소유권과 Free 히스토리 기간을 강제한다).
   - `EmptyDashboardCard`를 렌더하는 조건을 "계좌 없음 또는 거래 없음"에서 "거래 없음"(`transactions.length === 0`) 하나로 단순화한다.
   - 헤더의 `{activeAccount.label} 지출 인사이트` 같은 계좌 라벨 기반 문구를 일반적인 문구(예: "지출 인사이트")로 바꾼다.
   - `DashboardInsights`에 넘기던 `accounts`/`activeAccountId` prop을 뺀다.
2. **`dashboard-insights.tsx`**: `AccountChips` 함수 컴포넌트를 삭제하고, `DashboardInsightsProps`에서 `accounts`/`activeAccountId`를 제거한다. `DashboardInsights` 본문에서 `<AccountChips .../>` 렌더 호출도 제거한다.
3. 이 두 파일 외에 `accounts`/`activeAccountId`를 참조하는 곳이 더 있는지 `grep -rn "activeAccountId\|AccountChips" src`로 확인하고 있다면 같이 정리한다.

## Acceptance Criteria

**이 step이 끝나면 `accounts`를 참조하는 애플리케이션 코드가 더 이상 하나도 없어야 한다** — step 0~2에서 의도적으로 미뤄뒀던 전체 그린 빌드가 여기서 처음으로 성립한다. 아래 두 커맨드가 모두 통과해야 완료로 볼 수 있다.

```bash
npm run build
npm test
```

빌드가 여전히 실패한다면, `grep -rn "accounts\|account_id\|activeAccountId" src`로 이 step 또는 이전 step들이 놓친 참조가 없는지 확인하라(단, `accounts`가 문자열로 우연히 매칭되는 무관한 코드는 무시).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - ADR-011대로 대시보드가 계좌 구분 없이 전체 거래를 하나의 뷰로 보여주는가?
   - RLS(Free 히스토리 3개월 제한)는 여전히 `transactions` 테이블 쿼리에 그대로 적용되는가(쿼리를 단순화하면서 실수로 별도 날짜 필터를 추가하거나 RLS를 우회하는 서비스 롤 클라이언트로 바꾸지 않았는지 확인)?
3. `phases/remove-accounts/index.json`의 step 3을 업데이트한다.

## 금지사항

- `has_locked_history()` RPC나 잠금 배너(`hasLockedHistory` prop) 로직은 계좌와 무관하니 건드리지 마라.
- `summarizeByCategory`/`summarizeByMonth`(`dashboardInsightService.ts`)는 이미 순수 함수로 계좌와 무관하게 동작한다 — 수정하지 마라.
- 업로드 플로우(`statement-upload-manager.tsx`, `uploads/page.tsx`)는 이미 step 2에서 끝났다 — 다시 손대지 마라.
- 기존 테스트를 깨뜨리지 마라. 계좌 관련이라 더 이상 성립하지 않는 테스트 케이스만 정리한다.
