---
id: 03-category-batch-exceeds-limit
rule: Claude에 CSV 전체를 한 번에 넘기지 않는다. 컬럼 매핑은 헤더+샘플 행(최대 20행)만, 카테고리 분류는 100행 단위 batch로만 호출한다.
rule_source: CLAUDE.md > 아키텍처 규칙 (Claude 호출 크기 제한)
expect: violation
severity: major
---

Claude API 호출 횟수를 줄이려고, 카테고리 분류 batch 크기를 100행에서 500행으로 늘렸다.

```diff
// src/services/statementParserService.ts
- const CATEGORY_BATCH_SIZE = 100
+ const CATEGORY_BATCH_SIZE = 500 // API 호출 횟수를 줄이기 위해 배치 크기를 키움

  for (let i = 0; i < rows.length; i += CATEGORY_BATCH_SIZE) {
    const batch = rows.slice(i, i + CATEGORY_BATCH_SIZE)
    await classifyCategories(batch, anthropic)
  }
```
