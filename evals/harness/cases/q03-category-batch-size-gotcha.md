---
id: q03-category-batch-size-gotcha
kind: qa
must: 100행 단위로 batch 호출해야 한다; 컬럼 매핑은 헤더+샘플 최대 20행만 사용한다; CSV 전체를 한 번에 Claude에 넘기면 안 된다
must_not: 500행씩 한 번에 보내도 상관없다; batch 크기에 특별한 제한은 없다
rule_source: CLAUDE.md > 아키텍처 규칙 (Claude 호출 크기 제한)
---

카테고리 분류할 때 Claude API 호출 횟수를 줄이려고 한 번에 500행씩 묶어서 보내면 되나요? batch 크기를 어떻게 잡아야 하죠?
