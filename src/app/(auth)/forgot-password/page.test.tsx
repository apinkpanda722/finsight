import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: authMocks.createClient,
}))

import ForgotPasswordPage from "./page"

beforeEach(() => {
  vi.clearAllMocks()
  authMocks.createClient.mockReturnValue({
    auth: { resetPasswordForEmail: authMocks.resetPasswordForEmail },
  })
})

describe("ForgotPasswordPage", () => {
  it("requests a recovery email with the PKCE callback URL", async () => {
    authMocks.resetPasswordForEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText("이메일"), "user@example.com")
    await user.click(screen.getByRole("button", { name: "재설정 링크 보내기" }))

    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "user@example.com",
      {
        redirectTo:
          "http://localhost:3000/auth/callback?next=/reset-password",
      }
    )
    expect(await screen.findByText("재설정 메일을 보냈습니다.")).toBeInTheDocument()
  })
})
