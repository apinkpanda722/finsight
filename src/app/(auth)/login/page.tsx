"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { FormEvent, Suspense, useMemo, useState } from "react"

import { AuthShell, FormField } from "@/components/auth/auth-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isSafeReturnPath } from "@/lib/auth/return-path"
import { createClient } from "@/lib/supabase/client"

type AuthView = "login" | "signup" | "verify"

type AuthError = {
  code?: string
  message: string
}

function isEmailNotConfirmed(error: AuthError) {
  const message = error.message.toLowerCase()
  return (
    error.code === "email_not_confirmed" ||
    message.includes("email not confirmed") ||
    error.message.includes("이메일을 확인하지 않았습니다")
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const [view, setView] = useState<AuthView>(
    searchParams.get("view") === "signup" ? "signup" : "login"
  )
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [error, setError] = useState("")
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false)
  const [notice, setNotice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setNotice("")
    setEmailNotConfirmed(false)
    setIsSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setIsSubmitting(false)
    if (signInError) {
      setError(signInError.message)
      setEmailNotConfirmed(isEmailNotConfirmed(signInError))
      return
    }

    const returnTo = searchParams.get("returnTo")
    router.push(returnTo && isSafeReturnPath(returnTo) ? returnTo : "/dashboard")
    router.refresh()
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("올바른 이메일 주소를 입력해주세요.")
      return
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.")
      return
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.")
      return
    }

    setIsSubmitting(true)
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setIsSubmitting(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    setView("verify")
  }

  async function handleResend() {
    setError("")
    setNotice("")
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    })

    if (resendError) {
      setError(resendError.message)
      return
    }

    setNotice("인증 메일을 다시 보냈습니다.")
  }

  if (view === "verify") {
    return (
      <AuthShell>
        <Badge variant="secondary">이메일 인증 대기 중</Badge>
        <p className="mt-2 text-xs text-muted-foreground">2단계 중 2번째</p>
        <h1 className="mt-4 text-[32px] leading-[1.13] tracking-[-0.4px]">
          메일함을 확인해주세요
        </h1>
        <p className="mt-2 text-base leading-6 text-[var(--color-body)]">
          <span className="break-all text-foreground">{email}</span> 주소로 인증
          메일을 보냈습니다. 링크를 클릭하면 가입이 완료됩니다.
        </p>
        {notice ? (
          <p className="mt-5 text-sm text-[var(--color-semantic-up)]">
            {notice}
          </p>
        ) : null}
        {error ? <p className="mt-5 text-sm text-destructive">{error}</p> : null}
        <Button
          className="mt-7 h-12 w-full text-base"
          onClick={() => setView("login")}
        >
          메일함에서 인증 완료했어요
        </Button>
        <button
          type="button"
          className="mt-5 w-full text-center text-sm text-primary hover:underline"
          onClick={handleResend}
        >
          인증 메일 다시 보내기
        </button>
      </AuthShell>
    )
  }

  if (view === "signup") {
    return (
      <AuthShell>
        <h1 className="text-[32px] leading-[1.13] tracking-[-0.4px]">회원가입</h1>
        <p className="mt-2 mb-7 text-sm text-muted-foreground">
          이메일로 가입하고 첫 명세서를 업로드하세요.
        </p>
        <form className="space-y-4" noValidate onSubmit={handleSignup}>
          <FormField id="signup-email" label="이메일">
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              className="h-12 px-4 text-base"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          <FormField id="signup-password" label="비밀번호">
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              className="h-12 px-4 text-base"
              placeholder="8자 이상"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
          <FormField
            id="signup-password-confirm"
            label="비밀번호 확인"
            error={error}
          >
            <Input
              id="signup-password-confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(error)}
              className="h-12 px-4 text-base"
              placeholder="비밀번호 재입력"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
            />
          </FormField>
          <Button disabled={isSubmitting} className="h-12 w-full text-base">
            {isSubmitting ? "가입 중" : "가입하기"}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          이미 계정이 있나요?{" "}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => setView("login")}
          >
            로그인
          </button>
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      {searchParams.has("justVerified") ? (
        <div className="mb-6 rounded-xl bg-[var(--color-surface-strong)] px-4 py-3 text-sm text-foreground">
          이메일 인증이 완료되었습니다. 로그인해주세요.
        </div>
      ) : null}
      <h1 className="mb-7 text-[32px] leading-[1.13] tracking-[-0.4px]">
        로그인
      </h1>
      <form className="space-y-4" noValidate onSubmit={handleLogin}>
        <FormField id="login-email" label="이메일">
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            className="h-12 px-4 text-base"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <FormField id="login-password" label="비밀번호" error={error}>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            className="h-12 px-4 text-base"
            placeholder="비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            비밀번호를 잊으셨나요?
          </Link>
        </div>
        {emailNotConfirmed ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={handleResend}
          >
            인증 메일 다시 보내기
          </Button>
        ) : null}
        {notice ? (
          <p className="text-sm text-[var(--color-semantic-up)]">{notice}</p>
        ) : null}
        <Button disabled={isSubmitting} className="h-12 w-full text-base">
          {isSubmitting ? "로그인 중" : "로그인"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        계정이 없나요?{" "}
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => setView("signup")}
        >
          회원가입
        </button>
      </p>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<AuthShell>로그인 화면을 불러오는 중입니다.</AuthShell>}
    >
      <LoginContent />
    </Suspense>
  )
}
