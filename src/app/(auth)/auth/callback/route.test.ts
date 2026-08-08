import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: authMocks.createClient,
}))

import { GET } from "./route"

beforeEach(() => {
  vi.clearAllMocks()
  authMocks.createClient.mockResolvedValue({
    auth: { exchangeCodeForSession: authMocks.exchangeCodeForSession },
  })
  authMocks.exchangeCodeForSession.mockResolvedValue({ error: null })
})

describe("GET /auth/callback", () => {
  it("exchanges the code and redirects a recovery flow to its safe next path", async () => {
    const response = await GET(
      new NextRequest(
        "https://finsight.test/auth/callback?code=pkce-code&next=%2Freset-password"
      )
    )

    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code")
    expect(response.headers.get("location")).toBe(
      "https://finsight.test/reset-password"
    )
  })

  it("replaces an unsafe next path with the dashboard", async () => {
    const response = await GET(
      new NextRequest(
        "https://finsight.test/auth/callback?code=pkce-code&next=%2F%2Fevil.com"
      )
    )

    expect(response.headers.get("location")).toBe(
      "https://finsight.test/dashboard"
    )
  })

  it("redirects signup confirmation to the dashboard", async () => {
    const response = await GET(
      new NextRequest("https://finsight.test/auth/callback?code=pkce-code")
    )

    expect(response.headers.get("location")).toBe(
      "https://finsight.test/dashboard"
    )
  })
})
