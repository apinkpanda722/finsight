import { describe, expect, it, vi } from "vitest"

import {
  getOwnedPolarCustomerId,
  handlePolarWebhookEvent,
  NoSubscriptionError,
} from "./subscriptionService"

const USER_ID = "8a1ca0d4-0a18-4fa5-b984-0a34eb1d6271"
const PRODUCT_ID = "1a1831cb-d013-431d-bd5d-d047ab1e12d1"
const MODIFIED_AT = new Date("2026-08-07T11:00:00.000Z")

function subscriptionPayload(
  status: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    type: "subscription.updated",
    data: {
      id: "sub_123",
      productId: PRODUCT_ID,
      customerId: "polar_customer_123",
      customer: {
        id: "polar_customer_123",
        externalId: USER_ID,
      },
      status,
      modifiedAt: MODIFIED_AT,
      currentPeriodEnd: new Date("2026-09-07T11:00:00.000Z"),
      cancelAtPeriodEnd: false,
      ...overrides,
    },
  }
}

function webhookSupabase(result: { error: unknown } = { error: null }) {
  const or = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ or })
  const update = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ update })

  return { supabase: { from }, from, update, eq, or }
}

function profileSupabase(result: {
  data: { polar_customer_id: string | null } | null
  error: unknown
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })

  return { supabase: { from }, from, select, eq, maybeSingle }
}

describe("handlePolarWebhookEvent", () => {
  it("quietly ignores events without subscription data", async () => {
    const db = webhookSupabase()

    await handlePolarWebhookEvent(
      { type: "customer.updated", data: { id: "customer_123" } },
      { supabase: db.supabase as never, proProductId: PRODUCT_ID }
    )

    expect(db.from).not.toHaveBeenCalled()
  })

  it("quietly ignores a subscription for another product", async () => {
    const db = webhookSupabase()

    await handlePolarWebhookEvent(
      subscriptionPayload("active", {
        productId: "different-product",
        customer: { id: "customer_123", externalId: "not-a-uuid" },
      }),
      { supabase: db.supabase as never, proProductId: PRODUCT_ID }
    )

    expect(db.from).not.toHaveBeenCalled()
  })

  it("throws when the Polar external customer id is not a UUID", async () => {
    const db = webhookSupabase()

    await expect(
      handlePolarWebhookEvent(
        subscriptionPayload("active", {
          customer: { id: "customer_123", externalId: "not-a-uuid" },
        }),
        { supabase: db.supabase as never, proProductId: PRODUCT_ID }
      )
    ).rejects.toThrow(/external customer id/i)
    expect(db.from).not.toHaveBeenCalled()
  })

  it.each(["active", "past_due", "trialing"])(
    "maps %s subscriptions to Pro",
    async (status) => {
      const db = webhookSupabase()

      await handlePolarWebhookEvent(subscriptionPayload(status), {
        supabase: db.supabase as never,
        proProductId: PRODUCT_ID,
      })

      expect(db.update).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: "pro",
          subscription_status: status,
          polar_subscription_id: "sub_123",
          polar_customer_id: "polar_customer_123",
          polar_product_id: PRODUCT_ID,
          polar_modified_at: MODIFIED_AT.toISOString(),
        })
      )
    }
  )

  it.each(["incomplete", "incomplete_expired", "unpaid", "canceled"])(
    "maps %s subscriptions to Free",
    async (status) => {
      const db = webhookSupabase()

      await handlePolarWebhookEvent(subscriptionPayload(status), {
        supabase: db.supabase as never,
        proProductId: PRODUCT_ID,
      })

      expect(db.update).toHaveBeenCalledWith(
        expect.objectContaining({ plan: "free", subscription_status: status })
      )
    }
  )

  it("uses a conditional update so stale events are ignored", async () => {
    const db = webhookSupabase()

    await expect(
      handlePolarWebhookEvent(subscriptionPayload("active"), {
        supabase: db.supabase as never,
        proProductId: PRODUCT_ID,
      })
    ).resolves.toBeUndefined()

    expect(db.eq).toHaveBeenCalledWith("id", USER_ID)
    expect(db.or).toHaveBeenCalledWith(
      `polar_modified_at.is.null,polar_modified_at.lt.${MODIFIED_AT.toISOString()}`
    )
  })

  it("propagates database errors for webhook retries", async () => {
    const databaseError = new Error("database unavailable")
    const db = webhookSupabase({ error: databaseError })

    await expect(
      handlePolarWebhookEvent(subscriptionPayload("active"), {
        supabase: db.supabase as never,
        proProductId: PRODUCT_ID,
      })
    ).rejects.toBe(databaseError)
  })
})

describe("getOwnedPolarCustomerId", () => {
  it("reads only the authenticated user's Polar customer id", async () => {
    const db = profileSupabase({
      data: { polar_customer_id: "polar_customer_123" },
      error: null,
    })

    await expect(
      getOwnedPolarCustomerId(USER_ID, { supabase: db.supabase as never })
    ).resolves.toBe("polar_customer_123")
    expect(db.from).toHaveBeenCalledWith("profiles")
    expect(db.select).toHaveBeenCalledWith("polar_customer_id")
    expect(db.eq).toHaveBeenCalledWith("id", USER_ID)
  })

  it("throws no_subscription when no Polar customer exists", async () => {
    const db = profileSupabase({
      data: { polar_customer_id: null },
      error: null,
    })

    await expect(
      getOwnedPolarCustomerId(USER_ID, { supabase: db.supabase as never })
    ).rejects.toMatchObject<Partial<NoSubscriptionError>>({
      code: "no_subscription",
    })
  })
})
