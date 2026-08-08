import { beforeEach, describe, expect, it, vi } from "vitest"

const authMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: authMocks.createClient,
}))

vi.mock("next/navigation", () => ({
  redirect: authMocks.redirect,
}))

import DashboardLayout from "./layout"

beforeEach(() => {
  vi.clearAllMocks()
  authMocks.createClient.mockResolvedValue({
    auth: { getClaims: authMocks.getClaims },
  })
})

describe("DashboardLayout", () => {
  it("renders authenticated dashboard content", async () => {
    authMocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-id" } },
      error: null,
    })

    const result = await DashboardLayout({ children: <main>대시보드</main> })

    expect(result).toEqual(<main>대시보드</main>)
    expect(authMocks.redirect).not.toHaveBeenCalled()
  })

  it("redirects unauthenticated access to login", async () => {
    authMocks.getClaims.mockResolvedValue({
      data: { claims: null },
      error: null,
    })

    await DashboardLayout({ children: <main>대시보드</main> })

    expect(authMocks.redirect).toHaveBeenCalledWith(
      "/login?returnTo=%2Fdashboard"
    )
  })
})
