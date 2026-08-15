---
id: q01-plan-update-webhook-only
kind: qa
must: profiles.plan과 구독 스냅샷 필드는 검증된 Polar webhook(service_role) 코드에서만 갱신해야 한다; 결제 성공 리다이렉트 라우트가 직접 낙관적으로 갱신하면 안 된다
must_not: 결제 완료 리다이렉트 라우트에서 즉시 profiles.plan을 pro로 업데이트해도 된다; UX를 위해서라면 낙관적 갱신이 허용된다
rule_source: CLAUDE.md > 아키텍처 규칙 (구독 상태 갱신은 webhook 전용)
---

결제 완료 후 리다이렉트되는 `/checkout/success` 라우트에서, 사용자가 곧바로 Pro 화면을 보게 하려고 `profiles.plan`을 즉시 `pro`로 업데이트하면 되나요? 웹훅이 도착할 때까지 기다리면 UX가 나빠질 것 같은데요.
