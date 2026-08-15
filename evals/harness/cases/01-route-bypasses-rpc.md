---
id: 01-route-bypasses-rpc
rule: accounts/uploaded_statements/transactions에 대한 쓰기는 반드시 create_statement_upload/finalize_statement RPC를 통해서만 한다. route handler가 이 테이블에 직접 INSERT/UPDATE하지 않는다.
rule_source: CLAUDE.md > 아키텍처 규칙 (RPC 전용 쓰기)
expect: violation
severity: critical
---

명세서 파싱이 끝난 뒤, route handler가 `finalize_statement` RPC를 거치지 않고 `transactions`/`uploaded_statements`에 직접 쓴다.

```diff
// src/app/api/statements/[id]/complete-upload/route.ts
  async function processStatement(statementId: string) {
    const supabase = createServiceRoleClient()
    const parsed = await parseStatement(statementId, {
      supabase,
      anthropic: createAnthropicClient(),
    })

-   await supabase.rpc("finalize_statement", {
-     p_statement_id: statementId,
-     p_transactions: parsed.transactions,
-   })
+   await supabase
+     .from("transactions")
+     .insert(parsed.transactions.map((row) => ({ ...row, statement_id: statementId })))
+   await supabase
+     .from("uploaded_statements")
+     .update({ status: "completed" })
+     .eq("id", statementId)
  }
```
