import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const pageMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  profileMaybeSingle: vi.fn(),
  requireUserId: vi.fn(),
  rpc: vi.fn(),
  transactionOrder: vi.fn(),
  transactionSelect: vi.fn(),
}))

vi.mock("@/lib/api/auth", () => ({
  requireUserId: pageMocks.requireUserId,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: pageMocks.createClient,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import DashboardPage from "./page"

beforeEach(() => {
  vi.clearAllMocks()
  pageMocks.requireUserId.mockResolvedValue("user-id")
  pageMocks.profileMaybeSingle.mockResolvedValue({
    data: { plan: "free" },
    error: null,
  })
  pageMocks.transactionOrder.mockResolvedValue({ data: [], error: null })
  pageMocks.rpc.mockResolvedValue({ data: false, error: null })
  pageMocks.transactionSelect.mockReturnValue({
    order: pageMocks.transactionOrder,
  })
  pageMocks.from.mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: pageMocks.profileMaybeSingle,
          }),
        }),
      }
    }

    if (table === "transactions") {
      return { select: pageMocks.transactionSelect }
    }

    throw new Error(`Unexpected table: ${table}`)
  })
  pageMocks.createClient.mockResolvedValue({
    from: pageMocks.from,
    rpc: pageMocks.rpc,
  })
})

describe("DashboardPage", () => {
  it("shows the first-upload empty state when there are no visible transactions", async () => {
    render(await DashboardPage())

    expect(
      screen.getByRole("heading", {
        name: "아직 업로드한 명세서가 없어요.",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText("첫 CSV/PDF를 업로드하거나 파일을 끌어다 놓아보세요")
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "CSV/PDF 업로드하기" })).toHaveAttribute(
      "href",
      "/uploads?upload=1"
    )
    expect(screen.queryByText(/mock/i)).not.toBeInTheDocument()
  })

  it("queries and renders all visible Pro transactions as one unified view", async () => {
    pageMocks.profileMaybeSingle.mockResolvedValue({
      data: { plan: "pro" },
      error: null,
    })
    pageMocks.transactionOrder.mockResolvedValue({
      data: [
        {
          amount: -42_000,
          category: "transport",
          transaction_date: "2026-08-03",
        },
        {
          amount: -18_000,
          category: "food_dining",
          transaction_date: "2026-08-04",
        },
      ],
      error: null,
    })

    render(await DashboardPage())

    expect(screen.getByRole("heading", { name: "지출 인사이트" })).toBeInTheDocument()
    expect(screen.getByText("교통")).toBeInTheDocument()
    expect(screen.getByText("식비")).toBeInTheDocument()
    expect(screen.getAllByText("42,000원").length).toBeGreaterThan(0)
    expect(
      screen.getByRole("button", { name: "PDF 리포트 다운로드" })
    ).toBeInTheDocument()
    expect(pageMocks.transactionSelect).toHaveBeenCalledWith(
      "amount, category, transaction_date"
    )
    expect(pageMocks.from).not.toHaveBeenCalledWith("accounts")
  })

  it("logs the underlying Postgrest error codes before failing", async () => {
    pageMocks.profileMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST301", message: "JWT expired" },
    })
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(DashboardPage()).rejects.toThrow(
      "대시보드 정보를 불러올 수 없습니다."
    )

    expect(consoleError).toHaveBeenCalledWith(
      "dashboard query failed",
      expect.objectContaining({ profileErrorCode: "PGRST301" })
    )

    consoleError.mockRestore()
  })

  it.each([
    [true, true],
    [false, false],
  ])(
    "uses has_locked_history=%s to set banner visibility",
    async (hasLockedHistory, shouldShowBanner) => {
      pageMocks.rpc.mockResolvedValue({
        data: hasLockedHistory,
        error: null,
      })
      pageMocks.transactionOrder.mockResolvedValue({
        data: [
          {
            amount: -10_000,
            category: "groceries",
            transaction_date: "2026-08-03",
          },
        ],
        error: null,
      })

      render(await DashboardPage())

      expect(pageMocks.rpc).toHaveBeenCalledWith("has_locked_history")
      expect(Boolean(screen.queryByText(/3개월 이전 데이터도 있어요/))).toBe(
        shouldShowBanner
      )
    }
  )
})
