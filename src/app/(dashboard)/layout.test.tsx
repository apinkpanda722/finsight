import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getClaims: vi.fn(),
  redirect: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: authMocks.createClient,
}))

vi.mock("next/navigation", () => ({
  redirect: authMocks.redirect,
}))

import DashboardLayout, { signOutAction } from "./layout"

beforeEach(() => {
  vi.clearAllMocks()
  authMocks.createClient.mockResolvedValue({
    auth: {
      getClaims: authMocks.getClaims,
      signOut: authMocks.signOut,
    },
    from: authMocks.from,
  })
  authMocks.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { plan: "free" },
          error: null,
        }),
      }),
    }),
  })
})

describe("DashboardLayout", () => {
  it("renders authenticated dashboard content", async () => {
    authMocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-id" } },
      error: null,
    })

    const result = await DashboardLayout({ children: <main>대시보드 내용</main> })

    render(result)

    expect(screen.getByText("대시보드 내용")).toBeInTheDocument()
    expect(screen.getByText("Free")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "개요" })).toHaveAttribute(
      "href",
      "/dashboard"
    )
    expect(screen.getByRole("link", { name: "명세서 관리" })).toHaveAttribute(
      "href",
      "/uploads"
    )
    expect(screen.getByRole("link", { name: "요금제" })).toHaveAttribute(
      "href",
      "/settings/billing"
    )
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument()
    expect(authMocks.redirect).not.toHaveBeenCalled()
  })

  it("renders a Pro badge from the authenticated user's profile", async () => {
    authMocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "pro-user-id" } },
      error: null,
    })
    authMocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { plan: "pro" },
            error: null,
          }),
        }),
      }),
    })

    render(await DashboardLayout({ children: <main>대시보드</main> }))

    expect(screen.getByText("Pro")).toBeInTheDocument()
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
    expect(authMocks.from).not.toHaveBeenCalled()
  })

  it("signs out and returns to the landing page", async () => {
    authMocks.signOut.mockResolvedValue({ error: null })

    await signOutAction()

    expect(authMocks.signOut).toHaveBeenCalledOnce()
    expect(authMocks.redirect).toHaveBeenCalledWith("/")
  })
})
