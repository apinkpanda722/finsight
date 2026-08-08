import { beforeEach, describe, expect, it, vi } from "vitest"

const webhookMocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  handlePolarWebhookEvent: vi.fn(),
  webhooks: vi.fn(),
}))

vi.mock("@polar-sh/nextjs", () => ({
  Webhooks: webhookMocks.webhooks,
}))

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    POLAR_PRO_PRODUCT_ID: "server-product-id",
    POLAR_WEBHOOK_SECRET: "server-webhook-secret",
  }),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: webhookMocks.createServiceRoleClient,
}))

vi.mock("@/services/subscriptionService", () => ({
  handlePolarWebhookEvent: webhookMocks.handlePolarWebhookEvent,
}))

webhookMocks.webhooks.mockReturnValue(vi.fn())
webhookMocks.createServiceRoleClient.mockReturnValue({ serviceRole: true })

await import("./route")

describe("POST /api/webhooks/polar", () => {
  beforeEach(() => {
    webhookMocks.handlePolarWebhookEvent.mockReset()
  })

  it("passes verified payloads to the subscription service with server deps", async () => {
    const config = webhookMocks.webhooks.mock.calls[0][0]
    const payload = { type: "subscription.updated", data: { id: "sub_123" } }

    await config.onPayload(payload)

    expect(config.webhookSecret).toBe("server-webhook-secret")
    expect(webhookMocks.handlePolarWebhookEvent).toHaveBeenCalledWith(payload, {
      supabase: { serviceRole: true },
      proProductId: "server-product-id",
    })
  })

  it("does not swallow service errors", async () => {
    const config = webhookMocks.webhooks.mock.calls[0][0]
    const databaseError = new Error("database unavailable")
    webhookMocks.handlePolarWebhookEvent.mockRejectedValue(databaseError)

    await expect(
      config.onPayload({ type: "subscription.updated", data: { id: "sub" } })
    ).rejects.toBe(databaseError)
  })
})
