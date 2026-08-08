import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import LandingPage from "./page"

describe("LandingPage", () => {
  it("connects every start CTA to the combined login and signup page", () => {
    render(<LandingPage />)

    const startLinks = screen.getAllByRole("link", { name: "무료로 시작하기" })

    expect(startLinks).toHaveLength(3)
    startLinks.forEach((link) => expect(link).toHaveAttribute("href", "/login"))
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
