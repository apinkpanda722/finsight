import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: supabaseMocks.createClient,
}))

import { middleware } from "./middleware"

function requestFor(path: string) {
  return new NextRequest(`https://finsight.test${path}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  supabaseMocks.createClient.mockResolvedValue({
    auth: { getClaims: supabaseMocks.getClaims },
  })
})

describe("middleware", () => {
  it("redirects an unauthenticated dashboard request to login", async () => {
    supabaseMocks.getClaims.mockResolvedValue({
      data: { claims: null },
      error: null,
    })

    const response = await middleware(requestFor("/dashboard"))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "https://finsight.test/login?returnTo=%2Fdashboard"
    )
    expect(supabaseMocks.getClaims).toHaveBeenCalledOnce()
  })

  it("allows an authenticated dashboard request", async () => {
    supabaseMocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-id" } },
      error: null,
    })

    const response = await middleware(requestFor("/dashboard"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })

  it.each(["/", "/login", "/forgot-password"])(
    "allows the public path %s without authentication",
    async (path) => {
      supabaseMocks.getClaims.mockResolvedValue({
        data: { claims: null },
        error: null,
      })

      const response = await middleware(requestFor(path))

      expect(response.status).toBe(200)
      expect(response.headers.get("location")).toBeNull()
      expect(supabaseMocks.getClaims).toHaveBeenCalledOnce()
    }
  )
})
