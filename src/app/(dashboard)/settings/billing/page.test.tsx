import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const pageMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
  requireUserId: vi.fn(),
}))

vi.mock("@/lib/api/auth", () => ({
  requireUserId: pageMocks.requireUserId,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: pageMocks.createClient,
}))

import BillingSettingsPage from "./page"

beforeEach(() => {
  vi.clearAllMocks()
  pageMocks.requireUserId.mockResolvedValue("user-id")
  pageMocks.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ maybeSingle: pageMocks.maybeSingle }),
    }),
  })
  pageMocks.createClient.mockResolvedValue({ from: pageMocks.from })
})

describe("BillingSettingsPage", () => {
  it("shows the Free plan and a POST checkout form", async () => {
    pageMocks.maybeSingle.mockResolvedValue({
      data: {
        plan: "free",
        subscription_status: null,
        current_period_end: null,
        cancel_at_period_end: false,
      },
      error: null,
    })

    render(await BillingSettingsPage())

    expect(
      within(
        screen.getByRole("region", { name: "현재 구독 상태" })
      ).getByText("Free")
    ).toBeInTheDocument()
    const upgradeButton = screen.getByRole("button", {
      name: "Pro로 업그레이드",
    })
    expect(upgradeButton.closest("form")).toHaveAttribute(
      "action",
      "/api/checkout"
    )
    expect(upgradeButton.closest("form")).toHaveAttribute("method", "POST")
  })

  it("shows Pro subscription warnings and a POST portal form", async () => {
    pageMocks.maybeSingle.mockResolvedValue({
      data: {
        plan: "pro",
        subscription_status: "past_due",
        current_period_end: "2026-09-01T00:00:00.000Z",
        cancel_at_period_end: true,
      },
      error: null,
    })

    render(await BillingSettingsPage())

    expect(screen.getByText("past_due")).toBeInTheDocument()
    expect(screen.getByText("결제 수단을 확인해주세요")).toBeInTheDocument()
    expect(
      screen.getByText(/까지 Pro 이용 가능, 이후 Free로 전환됩니다/)
    ).toBeInTheDocument()
    const manageButton = screen.getByRole("button", { name: "구독 관리" })
    expect(manageButton.closest("form")).toHaveAttribute(
      "action",
      "/api/portal"
    )
    expect(manageButton.closest("form")).toHaveAttribute("method", "POST")
  })
})
