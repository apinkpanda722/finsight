---
id: q02-locked-history-rpc-only
kind: qa
must: has_locked_history() RPC만으로 확인해야 한다; 실제 거래를 조회해서 존재 여부를 판단하면 안 된다
must_not: transactions 테이블을 date 컬럼으로 직접 SELECT해도 된다
rule_source: CLAUDE.md > 아키텍처 규칙 (Free 잠금 히스토리)
---

Free 사용자에게 "3개월 이전 거래가 더 있다"는 잠금 배지를 보여주려고 합니다. `transactions` 테이블에서 `date < now() - interval '3 months'`로 직접 조회해서 개수만 세면 되나요?
