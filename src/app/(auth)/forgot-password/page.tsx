"use client"

import Link from "next/link"
import posthog from "posthog-js"
import { FormEvent, useMemo, useState } from "react"

import { AuthShell, FormField } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      }
    )

    setIsSubmitting(false)
    if (resetError) {
      setError(resetError.message)
      return
    }

    posthog.capture("password_reset_requested")
    setSent(true)
  }

  return (
    <AuthShell>
      <h1 className="text-[32px] leading-[1.13] tracking-[-0.4px]">
        비밀번호 재설정
      </h1>
      <p className="mt-2 mb-7 text-sm text-muted-foreground">
        가입한 이메일 주소를 입력하면 재설정 링크를 보내드립니다.
      </p>
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <FormField id="recovery-email" label="이메일" error={error}>
          <Input
            id="recovery-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(error)}
            className="h-12 px-4 text-base"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        {sent ? (
          <p className="text-sm text-[var(--color-semantic-up)]">
            재설정 메일을 보냈습니다.
          </p>
        ) : null}
        <Button disabled={isSubmitting || sent} className="h-12 w-full text-base">
          {isSubmitting ? "보내는 중" : sent ? "전송 완료" : "재설정 링크 보내기"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </AuthShell>
  )
}
