import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: authMocks.createClient,
}))

import {
  assertSameOrigin,
  requireUserId,
  SameOriginError,
  UnauthorizedError,
} from "./auth"

beforeEach(() => {
  vi.clearAllMocks()
  authMocks.createClient.mockResolvedValue({
    auth: { getClaims: authMocks.getClaims },
  })
})

describe("assertSameOrigin", () => {
  it("accepts a request whose Origin matches its host", () => {
    const request = new NextRequest("https://finsight.test/api/checkout", {
      method: "POST",
      headers: { host: "finsight.test", origin: "https://finsight.test" },
    })

    expect(() => assertSameOrigin(request)).not.toThrow()
  })

  it("rejects a request from a different Origin", () => {
    const request = new NextRequest("https://finsight.test/api/checkout", {
      method: "POST",
      headers: { host: "finsight.test", origin: "https://attacker.test" },
    })

    expect(() => assertSameOrigin(request)).toThrow(SameOriginError)
  })

  it("rejects a request without an Origin header", () => {
    const request = new NextRequest("https://finsight.test/api/checkout", {
      method: "POST",
      headers: { host: "finsight.test" },
    })

    expect(() => assertSameOrigin(request)).toThrow(SameOriginError)
  })
})

describe("requireUserId", () => {
  it("returns the subject from verified claims", async () => {
    authMocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "8a1ca0d4-0a18-4fa5-b984-0a34eb1d6271" } },
      error: null,
    })

    await expect(requireUserId()).resolves.toBe(
      "8a1ca0d4-0a18-4fa5-b984-0a34eb1d6271"
    )
    expect(authMocks.getClaims).toHaveBeenCalledOnce()
  })

  it("rejects a request without verified claims", async () => {
    authMocks.getClaims.mockResolvedValue({
      data: { claims: null },
      error: null,
    })

    await expect(requireUserId()).rejects.toBeInstanceOf(UnauthorizedError)
  })
})
