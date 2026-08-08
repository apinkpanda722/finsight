import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const routeMocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  checkoutsCreate: vi.fn(),
  createPolarClient: vi.fn(),
  requireUserId: vi.fn(),
}))

vi.mock("@/lib/api/auth", () => ({
  assertSameOrigin: routeMocks.assertSameOrigin,
  requireUserId: routeMocks.requireUserId,
  SameOriginError: class SameOriginError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
}))

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    POLAR_PRO_PRODUCT_ID: "server-product-id",
    SUCCESS_URL: "https://finsight.test/billing/success",
  }),
}))

vi.mock("@/lib/polar/client", () => ({
  createPolarClient: routeMocks.createPolarClient,
}))

import { POST } from "./route"

beforeEach(() => {
  vi.clearAllMocks()
  routeMocks.requireUserId.mockResolvedValue("server-user-id")
  routeMocks.createPolarClient.mockReturnValue({
    checkouts: { create: routeMocks.checkoutsCreate },
  })
  routeMocks.checkoutsCreate.mockResolvedValue({
    url: "https://sandbox.polar.sh/checkout/server-session",
  })
})

describe("POST /api/checkout", () => {
  it("uses only the server product and authenticated user", async () => {
    const request = new NextRequest(
      "https://finsight.test/api/checkout?productId=attacker-product",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "finsight.test",
          origin: "https://finsight.test",
        },
        body: JSON.stringify({
          productId: "body-product",
          customerId: "another-customer",
        }),
      }
    )

    const response = await POST(request)

    expect(routeMocks.assertSameOrigin).toHaveBeenCalledWith(request)
    expect(routeMocks.checkoutsCreate).toHaveBeenCalledWith({
      products: ["server-product-id"],
      externalCustomerId: "server-user-id",
      successUrl: "https://finsight.test/billing/success",
    })
    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe(
      "https://sandbox.polar.sh/checkout/server-session"
    )
  })
})
