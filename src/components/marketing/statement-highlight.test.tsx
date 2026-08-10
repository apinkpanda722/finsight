import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { SAMPLE_TRANSACTIONS } from "./sample-preview"
import { StatementHighlight } from "./statement-highlight"
import {
  summarizeByCategory,
  summarizeByMonth,
} from "@/services/dashboardInsightService"
import { CATEGORY_LABELS } from "@/types/domain"

function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`
}

function formatMonthLabel(month: string): string {
  return `${Number(month.slice(5))}월`
}

describe("StatementHighlight", () => {
  it("renders the raw CSV mock next to the organized result", () => {
    render(<StatementHighlight />)

    expect(
      screen.getByText("같은 명세서에서 finsight가 무엇을 정리하는지 보여드립니다")
    ).toBeInTheDocument()
    expect(screen.getByText("raw_statement.csv")).toBeInTheDocument()
    expect(screen.getByText("이탈리안 레스토랑")).toBeInTheDocument()
  })

  it("shows the top spending category by default", () => {
    render(<StatementHighlight />)

    const [top] = summarizeByCategory(SAMPLE_TRANSACTIONS)
    const label = CATEGORY_LABELS[top.category] ?? top.category

    expect(screen.getByRole("tab", { name: "카테고리 톱" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByText(formatWon(top.total))).toBeInTheDocument()
    expect(screen.getByText(`가장 큰 지출 카테고리 · ${label}`)).toBeInTheDocument()
  })

  it("switches to the peak month total when the monthly tab is selected", async () => {
    const user = userEvent.setup()
    render(<StatementHighlight />)

    const monthly = summarizeByMonth(SAMPLE_TRANSACTIONS)
    const [peak] = [...monthly].sort((a, b) => b.total - a.total)

    await user.click(screen.getByRole("tab", { name: "월별 추이" }))

    expect(screen.getByRole("tab", { name: "월별 추이" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByText(formatWon(peak.total))).toBeInTheDocument()
    expect(
      screen.getByText(`지출이 가장 많았던 달 · ${formatMonthLabel(peak.month)}`)
    ).toBeInTheDocument()
  })

  it("scales both cards on hover, matching the rest of the landing page", () => {
    const { container } = render(<StatementHighlight />)
    const cards = container.querySelectorAll('[data-slot="card"]')

    expect(cards).toHaveLength(2)
    cards.forEach((card) => {
      expect(card).toHaveClass("hover:scale-[1.02]")
    })
  })

  it("does not mention features finsight does not build in this MVP", () => {
    render(<StatementHighlight />)

    expect(screen.queryByText(/이상\s*거래/)).not.toBeInTheDocument()
    expect(screen.queryByText(/구독\s*누수/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^AI/)).not.toBeInTheDocument()
  })
})
