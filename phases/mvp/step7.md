# Step 7: dashboard-insights

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- step 1의 `has_locked_history()` RPC와 `transactions`/`accounts` RLS 정책
- step 3의 대시보드 셸(`(dashboard)/dashboard/page.tsx`가 지금은 빈 상태만 보여준다), step 4의 plan 배지

## 작업

### 1. 차트 컴포넌트

```bash
npx shadcn@latest add chart
```
(recharts 기반 shadcn 차트 프리미티브가 `src/components/ui/`에 추가된다 — tdd-guard 예외.)

### 2. 계좌 선택기

`accounts` 테이블에서 로그인한 사용자의 계좌 목록을 조회한다(RLS로 이미 본인 것만 보임). Free는 계좌가 최대 1개라 선택기가 사실상 안 보이거나 자동 선택되고, Pro는 여러 계좌 중 하나를 골라 그 계좌의 인사이트만 본다. **여러 계좌를 합산하는 뷰는 만들지 마라 — 이번 MVP 범위 밖이다.**

### 3. 계좌별 거래 조회

선택된 계좌의 거래를 `transactions`와 `uploaded_statements`를 조인해 조회한다(`uploaded_statements.account_id`로 필터):

```typescript
const { data } = await supabase
  .from('transactions')
  .select('*, uploaded_statements!inner(account_id)')
  .eq('uploaded_statements.account_id', accountId)
  .order('transaction_date', { ascending: true });
```

`transactions`의 RLS 정책이 소유권과 Free의 현재 달 포함 최근 3개 달 제한을 이미 강제하므로, 이 쿼리는 클라이언트/서버 어느 쪽에서 실행해도 안전하다(추가 날짜 필터를 애플리케이션 코드에서 다시 구현하지 마라 — RLS가 유일한 소스다).

### 4. 카테고리별 지출 요약 + 월별 추이

받아온 행을 애플리케이션 코드(순수 함수, 테스트 대상)로 집계한다 — 별도 집계 뷰/RPC를 만들지 않는다(MVP 단순화):

- `summarizeByCategory(transactions): { category: string; total: number }[]` — `amount < 0 && !['income','transfer'].includes(category)`인 행만 카테고리별로 합산한다.
- `summarizeByMonth(transactions): { month: string; total: number }[]` — 같은 필터로 `transaction_date`의 연-월별 합산(월별 추이 차트용, 금액은 절대값으로 표시해도 됨).

### 5. Free 히스토리 잠금 배너

`has_locked_history()` RPC를 호출해 `true`면 "N개월 이전 데이터도 있어요 — Pro로 업그레이드하면 전체 히스토리를 볼 수 있습니다" 형태의 배너 + `/settings/billing`으로 가는 CTA를 보여준다. **실제 잠긴 데이터를 조회해서 존재를 판단하지 마라 — 이 RPC의 boolean 결과만 사용한다.**

### 6. 빈 상태 대체

계좌는 있지만 완료된 statement가 없으면(아직 처리 중이거나 전부 실패) step 3의 빈 상태 UI를 유지한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm test
```

## 검증 절차

1. 위 AC를 실행한다.
2. `summarizeByCategory`/`summarizeByMonth`를 income/transfer 포함 fixture로 테스트해 지출 합계에서 정확히 제외되는지 확인한다.
3. 여러 계좌를 가진 Pro 테스트 계정에서 계좌 선택기가 계좌별로 다른 데이터를 보여주고, 합산 뷰가 존재하지 않는지 수동 확인한다.
4. `has_locked_history()`가 `true`/`false`일 때 배너 노출이 각각 맞는지 테스트한다.
5. 결과에 따라 `phases/mvp/index.json`의 step 7 항목을 업데이트한다.

## 금지사항

- `transactions` 조회에 날짜 범위를 애플리케이션 코드로 다시 필터링하지 마라 — RLS가 유일한 소스여야 한다(중복 로직은 나중에 RLS와 어긋날 수 있다).
- 여러 계좌의 거래를 합쳐서 보여주는 UI나 쿼리를 만들지 마라 — PRD.md에 명시된 MVP 제외 항목이다.
- `has_locked_history()` 대신 `transactions`를 직접 조회해서 과거 데이터 존재를 판단하지 마라 — RLS 우회 시도로 오인될 수 있는 패턴이다.
- 카테고리별 집계용 새 DB 뷰나 RPC를 만들지 마라 — 이 step은 애플리케이션 레벨 집계로 충분하다는 결정이 이미 내려졌다.
- 기존 테스트를 깨뜨리지 마라.
