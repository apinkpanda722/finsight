import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AuthShell, FormField } from "./auth-shell"

describe("AuthShell", () => {
  it("renders the shared wordmark and card content", () => {
    render(
      <AuthShell>
        <h1>로그인</h1>
      </AuthShell>
    )

    expect(screen.getByText("finsight")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "로그인" })).toBeInTheDocument()
  })
})

describe("FormField", () => {
  it("associates its label and error with the field", () => {
    render(
      <FormField id="email" label="이메일" error="이메일을 입력해주세요.">
        <input id="email" />
      </FormField>
    )

    expect(screen.getByLabelText("이메일")).toBeInTheDocument()
    expect(screen.getByText("이메일을 입력해주세요.")).toBeInTheDocument()
  })
})
