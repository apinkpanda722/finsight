import { act, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const pageMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getClaims: vi.fn(),
  maybeSingle: vi.fn(),
  replace: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: pageMocks.replace }),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: pageMocks.createClient,
}))

import BillingSuccessPage from "./page"

beforeEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  pageMocks.getClaims.mockResolvedValue({
    data: { claims: { sub: "user-id" } },
    error: null,
  })
  pageMocks.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ maybeSingle: pageMocks.maybeSingle }),
    }),
  })
  pageMocks.createClient.mockReturnValue({
    auth: { getClaims: pageMocks.getClaims },
    from: pageMocks.from,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("BillingSuccessPage", () => {
  it("shows a processing state while waiting for the webhook", () => {
    pageMocks.maybeSingle.mockResolvedValue({
      data: { plan: "free" },
      error: null,
    })

    render(<BillingSuccessPage />)

    expect(screen.getByText("결제 처리 중...")).toBeInTheDocument()
  })

  it("moves to the dashboard once the profile becomes Pro", async () => {
    pageMocks.maybeSingle.mockResolvedValue({
      data: { plan: "pro" },
      error: null,
    })

    render(<BillingSuccessPage />)

    await waitFor(() => {
      expect(pageMocks.replace).toHaveBeenCalledWith("/dashboard")
    })
  })

  it("shows where to check after 60 unsuccessful polls", async () => {
    vi.useFakeTimers()
    pageMocks.maybeSingle.mockResolvedValue({
      data: { plan: "free" },
      error: null,
    })

    render(<BillingSuccessPage />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })

    expect(pageMocks.maybeSingle).toHaveBeenCalledTimes(60)
    expect(
      screen.getByText("/settings/billing에서 상태를 확인해주세요")
    ).toBeInTheDocument()
    expect(pageMocks.replace).not.toHaveBeenCalled()
  })
})
