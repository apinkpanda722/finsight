import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import LandingPage from "./page"

describe("LandingPage", () => {
  it("connects every start CTA to the combined login and signup page", () => {
    render(<LandingPage />)

    const startLinks = screen.getAllByRole("link", { name: "무료로 시작하기" })

    expect(startLinks).toHaveLength(2)
    startLinks.forEach((link) => expect(link).toHaveAttribute("href", "/login"))
  })

  it("removes the closing CTA section in favor of plan-card CTAs", () => {
    render(<LandingPage />)

    expect(
      screen.queryByText("첫 명세서에서 지출 흐름을 확인해보세요.")
    ).not.toBeInTheDocument()
  })

  it("routes each plan card's own button through the right signup flow", () => {
    render(<LandingPage />)

    expect(screen.getByRole("link", { name: "Free로 시작" })).toHaveAttribute(
      "href",
      "/login"
    )
    expect(screen.getByRole("link", { name: "Pro로 시작" })).toHaveAttribute(
      "href",
      "/login?returnTo=/settings/billing"
    )
  })

  it("scales every card on hover for a consistent interaction", () => {
    const { container } = render(<LandingPage />)
    const cards = container.querySelectorAll('[data-slot="card"]')

    expect(cards.length).toBeGreaterThan(0)
    cards.forEach((card) => {
      expect(card).toHaveClass("hover:scale-[1.02]")
    })
  })

  it("presents the product previews and three core features", () => {
    render(<LandingPage />)

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "지출을 있는 그대로, 이해하기 쉽게.",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("이번 달 지출")).toBeInTheDocument()
    expect(screen.getByText("카테고리 미리보기")).toBeInTheDocument()
    expect(screen.getByText("자동 컬럼 매핑")).toBeInTheDocument()
    expect(screen.getByText("카테고리 자동 분류")).toBeInTheDocument()
    expect(screen.getByText("계좌별 히스토리")).toBeInTheDocument()
  })

  it("shows a sample statement preview before signup", () => {
    render(<LandingPage />)

    expect(
      screen.getByRole("heading", {
        name: "가입 전에 분석 결과를 먼저 확인하세요.",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("거래 수")).toBeInTheDocument()
    expect(screen.getByText("샘플 지출")).toBeInTheDocument()
    expect(
      screen.getByRole("img", { name: /월별 지출 추이/ })
    ).toBeInTheDocument()
  })

  it("compares the Free and Pro plan limits", () => {
    render(<LandingPage />)

    expect(screen.getByRole("heading", { name: "Free" })).toBeInTheDocument()
    expect(screen.getByText("계좌 1개")).toBeInTheDocument()
    expect(screen.getByText("최근 3개월 히스토리")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Pro" })).toBeInTheDocument()
    expect(screen.getByText("다중 계좌")).toBeInTheDocument()
    expect(screen.getByText("계좌별 무제한 히스토리")).toBeInTheDocument()
  })
})
