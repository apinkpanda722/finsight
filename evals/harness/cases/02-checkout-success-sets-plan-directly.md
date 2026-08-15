---
id: 02-checkout-success-sets-plan-directly
rule: profiles.plan과 구독 스냅샷 필드(subscription_status·polar_subscription_id·current_period_end 등)는 검증된 Polar webhook 코드(service_role)에서만 갱신한다. 다른 라우트나 클라이언트가 직접 update하지 않는다.
rule_source: CLAUDE.md > 아키텍처 규칙 (구독 상태 갱신은 webhook 전용)
expect: violation
severity: critical
---

결제 완료 후 리다이렉트되는 라우트에서, 사용자가 곧바로 Pro 화면을 보게 하려고 웹훅을 기다리지 않고 `profiles.plan`을 낙관적으로 먼저 갱신했다.

```diff
// src/app/api/checkout/success/route.ts
  export async function GET(request: NextRequest) {
    const userId = await requireUserId()

+   // 웹훅 도착까지 기다리면 대시보드가 잠깐 Free로 보이므로, 리다이렉트 시점에 먼저 반영한다.
+   await createServiceRoleClient()
+     .from("profiles")
+     .update({ plan: "pro", subscription_status: "active" })
+     .eq("id", userId)

    return NextResponse.redirect(new URL("/dashboard?welcome=pro", request.url))
  }
```
