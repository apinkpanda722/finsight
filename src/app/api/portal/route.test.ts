import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const routeMocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  createClient: vi.fn(),
  createPolarClient: vi.fn(),
  customerSessionsCreate: vi.fn(),
  getOwnedPolarCustomerId: vi.fn(),
  requireUserId: vi.fn(),
}))

vi.mock("@/lib/api/auth", () => ({
  assertSameOrigin: routeMocks.assertSameOrigin,
  requireUserId: routeMocks.requireUserId,
  SameOriginError: class SameOriginError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
}))

vi.mock("@/lib/polar/client", () => ({
  createPolarClient: routeMocks.createPolarClient,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: routeMocks.createClient,
}))

vi.mock("@/services/subscriptionService", () => ({
  getOwnedPolarCustomerId: routeMocks.getOwnedPolarCustomerId,
  NoSubscriptionError: class NoSubscriptionError extends Error {
    code = "no_subscription"
  },
}))

import { POST } from "./route"

beforeEach(() => {
  vi.clearAllMocks()
  routeMocks.requireUserId.mockResolvedValue("server-user-id")
  routeMocks.createClient.mockResolvedValue({ profileClient: true })
  routeMocks.getOwnedPolarCustomerId.mockResolvedValue(
    "server-polar-customer-id"
  )
  routeMocks.createPolarClient.mockReturnValue({
    customerSessions: { create: routeMocks.customerSessionsCreate },
  })
  routeMocks.customerSessionsCreate.mockResolvedValue({
    customerPortalUrl: "https://polar.sh/portal/server-session",
  })
})

describe("POST /api/portal", () => {
  it("uses only the authenticated user's owned customer id", async () => {
    const request = new NextRequest(
      "https://finsight.test/api/portal?customerId=attacker-customer",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "finsight.test",
          origin: "https://finsight.test",
        },
        body: JSON.stringify({ customerId: "body-customer" }),
      }
    )

    const response = await POST(request)

    expect(routeMocks.assertSameOrigin).toHaveBeenCalledWith(request)
    expect(routeMocks.getOwnedPolarCustomerId).toHaveBeenCalledWith(
      "server-user-id",
      { supabase: { profileClient: true } }
    )
    expect(routeMocks.customerSessionsCreate).toHaveBeenCalledWith({
      customerId: "server-polar-customer-id",
    })
    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe(
      "https://polar.sh/portal/server-session"
    )
  })
})
