import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  replace: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: authMocks.createClient,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: authMocks.replace }),
}))

import ResetPasswordPage from "./page"

beforeEach(() => {
  vi.clearAllMocks()
  authMocks.createClient.mockReturnValue({
    auth: {
      getClaims: authMocks.getClaims,
      updateUser: authMocks.updateUser,
    },
  })
})

describe("ResetPasswordPage", () => {
  it("redirects when there is no recovery session", async () => {
    authMocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null })

    render(<ResetPasswordPage />)

    await waitFor(() =>
      expect(authMocks.replace).toHaveBeenCalledWith("/forgot-password")
    )
  })

  it("updates the password for a verified recovery session", async () => {
    authMocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-id" } },
      error: null,
    })
    authMocks.updateUser.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<ResetPasswordPage />)

    await screen.findByRole("heading", { name: "새 비밀번호 설정" })
    await user.type(screen.getByLabelText("새 비밀번호"), "newpassword123")
    await user.type(
      screen.getByLabelText("새 비밀번호 확인"),
      "newpassword123"
    )
    await user.click(screen.getByRole("button", { name: "비밀번호 변경" }))

    expect(authMocks.updateUser).toHaveBeenCalledWith({
      password: "newpassword123",
    })
    expect(
      await screen.findByRole("heading", { name: "비밀번호가 변경되었습니다" })
    ).toBeInTheDocument()
  })
})
