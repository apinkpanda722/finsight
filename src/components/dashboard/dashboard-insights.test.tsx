import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DashboardInsights } from "./dashboard-insights"

const baseProps = {
  accounts: [
    { id: "account-1", label: "신한카드" },
    { id: "account-2", label: "국민은행" },
  ],
  activeAccountId: "account-2",
  categories: [{ category: "food_dining", total: 30_000 }],
  monthly: [
    { month: "2026-07", total: 20_000 },
    { month: "2026-08", total: 30_000 },
  ],
  currentMonth: "2026-08",
  plan: "pro" as const,
  hasLockedHistory: false,
}

describe("DashboardInsights", () => {
  it("offers only individual account choices and marks the selected account", () => {
    render(<DashboardInsights {...baseProps} />)

    expect(screen.getByRole("link", { name: "신한카드" })).toHaveAttribute(
      "href",
      "/dashboard?account=account-1"
    )
    expect(screen.getByRole("link", { name: "국민은행" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.queryByText(/통합|합산/)).not.toBeInTheDocument()
  })

  it("renders category amounts and a div-based monthly trend without a chart library", () => {
    render(<DashboardInsights {...baseProps} />)

    expect(screen.getByText("식비")).toBeInTheDocument()
    expect(screen.getAllByText("30,000원")[0]).toHaveClass("financial-number")
    expect(
      screen.getByRole("img", { name: "월별 지출 추이" }).querySelectorAll(
        "[data-month-bar]"
      )
    ).toHaveLength(2)
  })

  it("shows the upgrade banner and locked month placeholders only from the RPC boolean", () => {
    const { rerender } = render(
      <DashboardInsights
        {...baseProps}
        plan="free"
        accounts={baseProps.accounts.slice(0, 1)}
        activeAccountId="account-1"
        hasLockedHistory
      />
    )

    expect(screen.getByText(/3개월 이전 데이터도 있어요/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Pro로 업그레이드" })).toHaveAttribute(
      "href",
      "/settings/billing"
    )
    expect(screen.getAllByLabelText(/잠김$/)).toHaveLength(9)

    rerender(
      <DashboardInsights
        {...baseProps}
        plan="free"
        accounts={baseProps.accounts.slice(0, 1)}
        activeAccountId="account-1"
        hasLockedHistory={false}
      />
    )

    expect(screen.queryByText(/3개월 이전 데이터도 있어요/)).not.toBeInTheDocument()
  })
})
