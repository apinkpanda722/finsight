import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import DashboardPage from "./page"

describe("DashboardPage", () => {
  it("shows the first-upload empty state without mock transactions", () => {
    render(<DashboardPage />)

    expect(
      screen.getByRole("heading", {
        name: "아직 업로드한 명세서가 없어요.",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("첫 CSV를 업로드해보세요")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "CSV 업로드하기" })).toHaveAttribute(
      "href",
      "/uploads"
    )
    expect(screen.queryByText(/mock/i)).not.toBeInTheDocument()
  })
})
