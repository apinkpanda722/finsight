---
id: 04-dashboard-queries-transactions-for-lock-badge
rule: Free 사용자의 과거(최근 3개월 이전) 거래 존재 여부는 has_locked_history() RPC만으로 확인한다. 실제 거래를 조회해 존재 여부를 판단하지 않는다.
rule_source: CLAUDE.md > 아키텍처 규칙 (Free 잠금 히스토리)
expect: violation
severity: critical
---

대시보드에 "더 오래된 거래가 있음" 잠금 배지를 표시하기 위해, `has_locked_history()` RPC 대신 `transactions` 테이블을 직접 count 쿼리했다.

```diff
// src/services/dashboardInsightService.ts
- const { data, error } = await supabase.rpc("has_locked_history", {
-   p_user_id: userId,
- })
- const hasLockedHistory = error ? false : (data ?? false)
+ const threeMonthsAgo = new Date()
+ threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
+
+ const { count } = await supabase
+   .from("transactions")
+   .select("id", { count: "exact", head: true })
+   .eq("user_id", userId)
+   .lt("date", threeMonthsAgo.toISOString())
+ const hasLockedHistory = (count ?? 0) > 0
```
