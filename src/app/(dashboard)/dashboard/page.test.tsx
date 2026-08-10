import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const pageMocks = vi.hoisted(() => ({
  accountsOrder: vi.fn(),
  createClient: vi.fn(),
  from: vi.fn(),
  profileMaybeSingle: vi.fn(),
  requireUserId: vi.fn(),
  rpc: vi.fn(),
  transactionEq: vi.fn(),
  transactionOrder: vi.fn(),
  transactionSelect: vi.fn(),
}))

vi.mock("@/lib/api/auth", () => ({
  requireUserId: pageMocks.requireUserId,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: pageMocks.createClient,
}))

import DashboardPage from "./page"

beforeEach(() => {
  vi.clearAllMocks()
  pageMocks.requireUserId.mockResolvedValue("user-id")
  pageMocks.profileMaybeSingle.mockResolvedValue({
    data: { plan: "free" },
    error: null,
  })
  pageMocks.accountsOrder.mockResolvedValue({
    data: [{ id: "account-1", label: "신한카드" }],
    error: null,
  })
  pageMocks.transactionOrder.mockResolvedValue({ data: [], error: null })
  pageMocks.rpc.mockResolvedValue({ data: false, error: null })
  pageMocks.transactionEq.mockReturnValue({ order: pageMocks.transactionOrder })
  pageMocks.transactionSelect.mockReturnValue({ eq: pageMocks.transactionEq })
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

    if (table === "accounts") {
      return {
        select: vi.fn().mockReturnValue({ order: pageMocks.accountsOrder }),
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
  it("shows the first-upload empty state when the selected account has no visible completed transactions", async () => {
    render(await DashboardPage({}))

    expect(
      screen.getByRole("heading", {
        name: "아직 업로드한 명세서가 없어요.",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("첫 CSV/PDF를 업로드해보세요")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "CSV/PDF 업로드하기" })).toHaveAttribute(
      "href",
      "/uploads?upload=1"
    )
    expect(screen.queryByText(/mock/i)).not.toBeInTheDocument()
  })

  it("queries and renders only the selected Pro account without a date filter or combined view", async () => {
    pageMocks.profileMaybeSingle.mockResolvedValue({
      data: { plan: "pro" },
      error: null,
    })
    pageMocks.accountsOrder.mockResolvedValue({
      data: [
        { id: "account-1", label: "신한카드" },
        { id: "account-2", label: "국민은행" },
      ],
      error: null,
    })
    pageMocks.transactionOrder.mockResolvedValue({
      data: [
        {
          amount: -42_000,
          category: "transport",
          transaction_date: "2026-08-03",
          uploaded_statements: { account_id: "account-2" },
        },
      ],
      error: null,
    })

    render(
      await DashboardPage({
        searchParams: Promise.resolve({ account: "account-2" }),
      })
    )

    expect(screen.getByText("교통")).toBeInTheDocument()
    expect(screen.getAllByText("42,000원").length).toBeGreaterThan(0)
    expect(pageMocks.transactionSelect).toHaveBeenCalledWith(
      "amount, category, transaction_date, uploaded_statements!inner(account_id)"
    )
    expect(pageMocks.transactionEq).toHaveBeenCalledWith(
      "uploaded_statements.account_id",
      "account-2"
    )
    expect(screen.queryByText(/통합|합산/)).not.toBeInTheDocument()
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
            uploaded_statements: { account_id: "account-1" },
          },
        ],
        error: null,
      })

      render(await DashboardPage({}))

      expect(pageMocks.rpc).toHaveBeenCalledWith("has_locked_history")
      expect(Boolean(screen.queryByText(/3개월 이전 데이터도 있어요/))).toBe(
        shouldShowBanner
      )
    }
  )
})
