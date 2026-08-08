import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { SAMPLE_TRANSACTIONS, SamplePreview } from "./sample-preview"
import {
  summarizeByCategory,
  summarizeByMonth,
} from "@/services/dashboardInsightService"

describe("SamplePreview", () => {
  it("shows a transaction count and total spend derived from the sample data", () => {
    render(<SamplePreview />)

    const categories = summarizeByCategory(SAMPLE_TRANSACTIONS)
    const total = categories.reduce((sum, summary) => sum + summary.total, 0)

    expect(
      screen.getByText(`${SAMPLE_TRANSACTIONS.length}건`)
    ).toBeInTheDocument()
    expect(
      screen.getByText(`${total.toLocaleString("ko-KR")}원`)
    ).toBeInTheDocument()
  })

  it("renders every sample category with its amount", () => {
    render(<SamplePreview />)

    const categories = summarizeByCategory(SAMPLE_TRANSACTIONS)
    for (const summary of categories) {
      expect(
        screen.getAllByText(`${summary.total.toLocaleString("ko-KR")}원`).length
      ).toBeGreaterThan(0)
    }
  })

  it("renders a line-based monthly trend with one point per sample month, not bars", () => {
    render(<SamplePreview />)

    const monthly = summarizeByMonth(SAMPLE_TRANSACTIONS)
    const chart = screen.getByRole("img", { name: /월별 지출 추이/ })

    expect(chart.querySelectorAll("[data-month-point]")).toHaveLength(
      monthly.length
    )
    expect(chart.querySelector("polyline")).toBeInTheDocument()
    expect(chart.querySelectorAll("[data-month-bar]")).toHaveLength(0)
  })

  it("shows a recent-period summary and one tile per sample month, wrapping instead of scrolling", () => {
    const { container } = render(<SamplePreview />)

    const monthly = summarizeByMonth(SAMPLE_TRANSACTIONS)
    expect(screen.getByText("최근 기간")).toBeInTheDocument()
    for (const month of monthly) {
      expect(screen.getByText(month.month.replace("-", "."))).toBeInTheDocument()
      expect(
        screen.getAllByText(`${month.total.toLocaleString("ko-KR")}원`).length
      ).toBeGreaterThan(0)
    }
    expect(container.querySelector(".overflow-x-auto")).not.toBeInTheDocument()
  })

  it("scales every sample card on hover, matching the rest of the landing page", () => {
    const { container } = render(<SamplePreview />)
    const cards = container.querySelectorAll('[data-slot="card"]')

    expect(cards.length).toBeGreaterThan(0)
    cards.forEach((card) => {
      expect(card).toHaveClass("hover:scale-[1.02]")
    })
  })

  it("does not mention features finsight does not build in this MVP", () => {
    render(<SamplePreview />)

    expect(screen.queryByText(/이상\s*거래/)).not.toBeInTheDocument()
    expect(screen.queryByText(/AI\s*인사이트/)).not.toBeInTheDocument()
  })
})
