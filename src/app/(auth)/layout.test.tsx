import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import AuthLayout, { metadata } from "./layout"

describe("AuthLayout", () => {
  it("keeps auth pages (login, password reset with tokens) out of search engine indexes", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false })
  })

  it("renders its children unchanged", () => {
    render(<AuthLayout>{<main>로그인 폼</main>}</AuthLayout>)

    expect(screen.getByText("로그인 폼")).toBeInTheDocument()
  })
})
