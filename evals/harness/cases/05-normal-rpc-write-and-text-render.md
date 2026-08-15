---
id: 05-normal-rpc-write-and-text-render
rule: "(오탐 방지) 서비스 함수는 deps로 주입된 클라이언트만 사용하고 finalize_statement RPC로만 쓴다. description은 JSX 텍스트 노드로만 렌더링한다."
rule_source: CLAUDE.md > 아키텍처 규칙 (RPC 전용 쓰기·신뢰할 수 없는 입력 렌더링) — 정상 코드
expect: pass
severity: none
---

`transactions` 테이블 이름과 `description` 필드가 등장해 위반 케이스들과 표면적으로 비슷해 보이지만, 쓰기는 RPC를 통해서만 하고 렌더링은 JSX 텍스트 노드만 쓰므로 정상이다.

```ts
// src/services/statementParserService.ts
export async function finalizeParsedStatement(
  statementId: string,
  parsed: ParsedStatement,
  deps: { supabase: SupabaseClient }
) {
  const { error } = await deps.supabase.rpc("finalize_statement", {
    p_statement_id: statementId,
    p_transactions: parsed.transactions,
  })
  if (error) throw new StatementParserError("finalize_failed")
}
```

```tsx
// src/components/dashboard/transaction-row.tsx
export function TransactionRow({ transaction }: { transaction: Transaction }) {
  return (
    <li className="flex justify-between py-2">
      <span className="text-sm">{transaction.description}</span>
      <span className="tabular-nums">{formatAmount(transaction.amount)}</span>
    </li>
  )
}
```
