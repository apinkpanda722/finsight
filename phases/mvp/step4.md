# Step 4: polar-billing

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-002, ADR-008)
- step 1의 `profiles` 스키마 (구독 스냅샷 필드), step 2의 `requireUserId` 패턴, step 3의 `(dashboard)` 셸/사이드바

## 작업

### 1. `src/lib/polar/client.ts` (tdd-guard 예외)

Polar SDK 클라이언트를 인스턴스화만 하는 함수. `env.POLAR_ACCESS_TOKEN`, `env.POLAR_SERVER`를 사용한다.

### 2. `assertSameOrigin` / `requireUserId` 헬퍼

`src/lib/api/same-origin.ts`(또는 `lib/api/auth.ts`)에 순수 함수로 분리하고 테스트를 먼저 작성한다:
- `assertSameOrigin(req: NextRequest): void` — `Origin` 헤더가 요청 host와 일치하지 않으면 예외를 던진다.
- `requireUserId(): Promise<string>` — `getClaims()`(`getSession()` 금지)로 세션을 확인하고 `sub`(user id)를 반환한다. 없으면 예외를 던진다(호출부에서 401로 변환).

### 3. Checkout / Portal 라우트 — **인증된 same-origin POST만, 입력값을 신뢰하지 않음**

```typescript
// app/api/checkout/route.ts
export async function POST(req: NextRequest) {
  assertSameOrigin(req);
  const userId = await requireUserId();
  const checkout = await polar.checkouts.create({
    products: [env.POLAR_PRO_PRODUCT_ID],
    externalCustomerId: userId,
    successUrl: env.SUCCESS_URL,
  });
  return NextResponse.redirect(checkout.url, 303);
}
```

```typescript
// app/api/portal/route.ts
export async function POST(req: NextRequest) {
  assertSameOrigin(req);
  const userId = await requireUserId();
  const customerId = await getOwnedPolarCustomerId(userId); // profiles.polar_customer_id (본인 것만)
  const session = await polar.customerSessions.create({ customerId });
  return NextResponse.redirect(session.customerPortalUrl, 303);
}
```

두 라우트 모두 body/query에서 product ID나 customer ID를 받지 않는다. `getOwnedPolarCustomerId`는 서비스 함수로 분리하고(`deps: { supabase }` 주입), 세션 사용자 본인의 `profiles.polar_customer_id`만 조회한다. 아직 구독한 적이 없어 `polar_customer_id`가 null이면 명확한 에러(`no_subscription`)를 던진다.

### 4. Webhook 라우트 + `subscriptionService.handlePolarWebhookEvent`

```typescript
// app/api/webhooks/polar/route.ts
import { Webhooks } from "@polar-sh/nextjs";
export const POST = Webhooks({
  webhookSecret: env.POLAR_WEBHOOK_SECRET,
  onPayload: (payload) => handlePolarWebhookEvent(payload, { supabase, proProductId: env.POLAR_PRO_PRODUCT_ID }),
  // onPayload가 던진 예외는 그대로 전파돼 5xx가 되고 Polar가 재시도한다 — 여기서 삼키지 마라.
});
```

`src/services/subscriptionService.ts`의 `handlePolarWebhookEvent(payload, deps)`:

1. 이벤트에 구독 데이터가 없으면(예: `customer.*` 이벤트) 조용히 return한다.
2. `payload.data.productId !== deps.proProductId`면 조용히 return한다(Free product나 다른 상품 이벤트는 무시).
3. `payload.data.customer.externalId`가 유효한 UUID인지 검증한다. 아니면 예외를 던진다(5xx로 재시도되지만 근본 원인은 설정 오류이므로 로그로 알 수 있어야 한다).
4. `trialing`/`active`/`past_due` 상태는 `plan='pro'`, 그 외(`incomplete`/`incomplete_expired`/`unpaid`/`canceled`)는 `plan='free'`로 매핑한다. `subscription.revoked` 이벤트도 payload의 `data.status`(보통 `canceled`)를 그대로 이 규칙에 태우면 자동으로 Free가 된다 — 이벤트 타입별 특수 분기를 만들지 마라.
5. `profiles`를 **단일 UPDATE**로 갱신한다. Stale/역순 이벤트가 최신 권한을 되돌리지 못하도록 WHERE 절에 `polar_modified_at is null or polar_modified_at < payload.data.modifiedAt` 조건을 반드시 포함한다(PostgREST: `.or('polar_modified_at.is.null,polar_modified_at.lt.' + modifiedAt)`).
6. DB 에러는 그대로 throw한다(삼키지 마라 — route가 5xx로 응답해야 Polar가 재시도한다).

### 5. `/billing/success` 페이지

`src/app/(dashboard)/billing/success/page.tsx`(Client Component): 도착 시 "결제 처리 중..." 표시 → `profiles.plan`을 2초 간격 최대 60회(2분) 폴링 → `plan==='pro'` 확인되면 `/dashboard`로 이동. 시간 초과 시 "/settings/billing에서 상태를 확인해주세요" 안내로 전환.

### 6. `/settings/billing` 페이지

`src/app/(dashboard)/settings/billing/page.tsx`: 현재 plan, `subscription_status`, `current_period_end`를 보여준다. Free면 "Pro로 업그레이드" 버튼, Pro면 "구독 관리" 버튼을 각각 `<form method="POST" action="/api/checkout">`/`<form method="POST" action="/api/portal">`로 구현한다(라우트가 POST 전용이므로 `fetch` 대신 실제 폼 제출로 303 리다이렉트를 브라우저가 자연스럽게 따라가게 한다). `subscription_status==='past_due'`면 "결제 수단을 확인해주세요" 배너를, `cancel_at_period_end===true`면 "OO까지 Pro 이용 가능, 이후 Free로 전환됩니다" 배너를 보여준다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm test
```

## 검증 절차

1. 위 AC를 실행한다.
2. `handlePolarWebhookEvent`에 대한 테스트로 다음을 확인한다: 잘못된 product 무시, `external_id`가 UUID가 아니면 예외, stale(`modifiedAt`이 더 과거인) 이벤트 무시, `active`/`past_due`/`trialing` → pro, 나머지 → free, DB 에러 시 예외 전파.
3. `assertSameOrigin`이 다른 Origin에서의 요청을 거부하는지 테스트로 확인한다.
4. `checkout`/`portal` route가 body/query의 product/customer 입력을 실제로 무시하는지(서버가 항상 세션 값으로 덮어쓰는지) 확인한다.
5. 결과에 따라 `phases/mvp/index.json`의 step 4 항목을 업데이트한다.

## 금지사항

- checkout/portal 라우트를 GET으로 만들거나 body/query의 product·customer 값을 사용하지 마라 — 이유: 타인 계정에 구독을 연결시키거나 타인 결제 포털에 접근하는 IDOR가 된다(CLAUDE.md CRITICAL).
- webhook 처리 중 예외를 catch해서 200을 반환하지 마라 — 이유: Polar가 재시도하지 않아 이벤트가 영구 유실된다.
- `polar_modified_at` staleness 검사 없이 `profiles`를 UPDATE하지 마라 — 이유: 역순으로 도착한 오래된 이벤트가 최신 Pro 상태를 Free로 되돌릴 수 있다.
- CSV/description과 마찬가지로 webhook payload 전체를 로그에 찍지 마라 — `event.type`, `event.data.id` 정도만 남긴다.
- 이 step에서 CSV 업로드/파싱 기능을 구현하지 마라 — step 5, 6의 범위다.
- 기존 테스트를 깨뜨리지 마라.
