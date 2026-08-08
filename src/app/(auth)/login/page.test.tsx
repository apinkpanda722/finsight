import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  resend: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: authMocks.createClient,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: authMocks.push, refresh: authMocks.refresh }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

import LoginPage from "./page"

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, "", "/login")
  authMocks.createClient.mockReturnValue({
    auth: {
      resend: authMocks.resend,
      signInWithPassword: authMocks.signInWithPassword,
      signUp: authMocks.signUp,
    },
  })
})

describe("LoginPage", () => {
  it("shows the verification banner from the query string", () => {
    window.history.replaceState({}, "", "/login?justVerified=1")

    render(<LoginPage />)

    expect(
      screen.getByText("이메일 인증이 완료되었습니다. 로그인해주세요.")
    ).toBeInTheDocument()
  })

  it("uses the safe return path after login", async () => {
    window.history.replaceState({}, "", "/login?returnTo=%2Fuploads")
    authMocks.signInWithPassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText("이메일"), "user@example.com")
    await user.type(screen.getByLabelText("비밀번호"), "password123")
    await user.click(screen.getByRole("button", { name: "로그인" }))

    await waitFor(() => expect(authMocks.push).toHaveBeenCalledWith("/uploads"))
    expect(authMocks.refresh).toHaveBeenCalledOnce()
  })

  it("falls back to the dashboard for an unsafe return path", async () => {
    window.history.replaceState({}, "", "/login?returnTo=%2F%2Fevil.com")
    authMocks.signInWithPassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText("이메일"), "user@example.com")
    await user.type(screen.getByLabelText("비밀번호"), "password123")
    await user.click(screen.getByRole("button", { name: "로그인" }))

    await waitFor(() =>
      expect(authMocks.push).toHaveBeenCalledWith("/dashboard")
    )
  })

  it("offers signup-email resend when the email is not confirmed", async () => {
    authMocks.signInWithPassword.mockResolvedValue({
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    })
    authMocks.resend.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText("이메일"), "user@example.com")
    await user.type(screen.getByLabelText("비밀번호"), "password123")
    await user.click(screen.getByRole("button", { name: "로그인" }))
    await user.click(await screen.findByRole("button", { name: "인증 메일 다시 보내기" }))

    expect(authMocks.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "user@example.com",
    })
  })

  it("shows the verification screen after signup", async () => {
    authMocks.signUp.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole("button", { name: "회원가입" }))
    await user.type(screen.getByLabelText("이메일"), "new@example.com")
    await user.type(screen.getByLabelText("비밀번호"), "password123")
    await user.type(screen.getByLabelText("비밀번호 확인"), "password123")
    await user.click(screen.getByRole("button", { name: "가입하기" }))

    expect(
      await screen.findByRole("heading", { name: "메일함을 확인해주세요" })
    ).toBeInTheDocument()
    expect(authMocks.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password123",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback",
      },
    })
  })
})
