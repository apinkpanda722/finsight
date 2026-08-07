"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useMemo, useState } from "react"

import { AuthShell, FormField } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [isSessionReady, setIsSessionReady] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    void supabase.auth.getClaims().then(({ data }) => {
      if (!active) return
      if (!data?.claims) {
        router.replace("/forgot-password")
        return
      }
      setIsSessionReady(true)
    })

    return () => {
      active = false
    }
  }, [router, supabase])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.")
      return
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.")
      return
    }

    setIsSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setIsSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setDone(true)
  }

  if (!isSessionReady) {
    return <AuthShell>재설정 세션을 확인하는 중입니다.</AuthShell>
  }

  if (done) {
    return (
      <AuthShell>
        <h1 className="text-[32px] leading-[1.13] tracking-[-0.4px]">
          비밀번호가 변경되었습니다
        </h1>
        <p className="mt-2 mb-7 text-sm text-muted-foreground">
          새 비밀번호로 로그인해주세요.
        </p>
        <Button asChild className="h-12 w-full text-base">
          <Link href="/login">로그인하러 가기</Link>
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="mb-7 text-[32px] leading-[1.13] tracking-[-0.4px]">
        새 비밀번호 설정
      </h1>
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <FormField id="new-password" label="새 비밀번호">
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            className="h-12 px-4 text-base"
            placeholder="8자 이상"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <FormField
          id="new-password-confirm"
          label="새 비밀번호 확인"
          error={error}
        >
          <Input
            id="new-password-confirm"
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
          {isSubmitting ? "변경 중" : "비밀번호 변경"}
        </Button>
      </form>
    </AuthShell>
  )
}
