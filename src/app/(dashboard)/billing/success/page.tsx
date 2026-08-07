"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"

const POLL_INTERVAL_MS = 2_000
const MAX_POLL_ATTEMPTS = 60

export default function BillingSuccessPage() {
  const replace = useRouter().replace
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function startPolling() {
      const { data } = await supabase.auth.getClaims()
      const userId = data?.claims?.sub

      if (typeof userId !== "string" || userId.length === 0) {
        if (!cancelled) setTimedOut(true)
        return
      }

      const authenticatedUserId = userId
      let attempts = 0

      async function pollPlan(): Promise<void> {
        if (cancelled) return

        attempts += 1
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", authenticatedUserId)
          .maybeSingle()

        if (cancelled) return
        if (profile?.plan === "pro") {
          replace("/dashboard")
          return
        }

        if (attempts >= MAX_POLL_ATTEMPTS) {
          setTimedOut(true)
          return
        }

        timer = setTimeout(pollPlan, POLL_INTERVAL_MS)
      }

      await pollPlan()
    }

    void startPolling()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [replace])

  return (
    <main className="flex min-h-screen items-center justify-center p-6 sm:p-10">
      <section className="w-full max-w-[560px] rounded-[var(--radius-xl)] border border-border bg-background p-10 text-center sm:p-14">
        <div
          aria-hidden="true"
          className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--color-surface-strong)] font-mono text-sm font-semibold"
        >
          Pro
        </div>
        {timedOut ? (
          <>
            <h1 className="mt-6 font-heading text-3xl tracking-[-0.02em]">
              결제 상태 확인이 지연되고 있습니다
            </h1>
            <p className="mt-3 text-muted-foreground" role="status">
              /settings/billing에서 상태를 확인해주세요
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-heading text-3xl tracking-[-0.02em]">
              결제 처리 중...
            </h1>
            <p className="mt-3 text-muted-foreground" role="status">
              구독 정보가 반영되면 대시보드로 이동합니다.
            </p>
          </>
        )}
      </section>
    </main>
  )
}
