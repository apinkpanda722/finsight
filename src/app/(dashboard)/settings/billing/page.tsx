import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { requireUserId } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"
import { withClockSkewRetry } from "@/lib/supabase/retry"

function formatPeriodEnd(value: string | null): string {
  if (!value) return "없음"

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeZone: "Asia/Seoul",
  }).format(new Date(value))
}

export default async function BillingSettingsPage() {
  const userId = await requireUserId()
  const supabase = await createClient()
  const { data: profile, error } = await withClockSkewRetry(() =>
    supabase
      .from("profiles")
      .select(
        "plan, subscription_status, current_period_end, cancel_at_period_end"
      )
      .eq("id", userId)
      .maybeSingle()
  )

  if (error) throw error

  const plan = profile?.plan === "pro" ? "pro" : "free"
  const periodEnd = formatPeriodEnd(profile?.current_period_end ?? null)

  return (
    <main className="p-6 sm:p-10">
      <div className="mx-auto max-w-[920px]">
        <div className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">요금제</p>
          <h1 className="mt-2 font-heading text-4xl tracking-[-0.03em]">
            구독 관리
          </h1>
        </div>

        {profile?.subscription_status === "past_due" ? (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius-md)] border border-border bg-[var(--color-surface-strong)] px-4 py-3 text-sm font-medium"
          >
            결제 수단을 확인해주세요
          </div>
        ) : null}

        {profile?.cancel_at_period_end === true ? (
          <div
            role="alert"
            className="mb-6 rounded-[var(--radius-md)] border border-border bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-body)]"
          >
            <span className="financial-number">{periodEnd}</span>까지 Pro 이용
            가능, 이후 Free로 전환됩니다
          </div>
        ) : null}

        <section
          aria-label="현재 구독 상태"
          className="mb-8 grid gap-4 rounded-[var(--radius-xl)] border border-border bg-background p-6 sm:grid-cols-3"
        >
          <div>
            <p className="text-sm text-muted-foreground">현재 요금제</p>
            <p className="mt-2 text-lg font-semibold">
              {plan === "pro" ? "Pro" : "Free"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">구독 상태</p>
            <p className="financial-number mt-2 text-sm font-medium">
              {profile?.subscription_status ?? "없음"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">현재 결제 기간 종료</p>
            <p className="financial-number mt-2 text-sm font-medium">
              {periodEnd}
            </p>
          </div>
        </section>

        <div className="grid max-w-[760px] gap-6 md:grid-cols-2">
          <section className="rounded-[var(--radius-xl)] border border-border bg-background p-8">
            <p className="text-sm font-medium text-muted-foreground">Free</p>
            <p className="financial-number mt-3 text-3xl font-semibold">무료</p>
            <ul className="mt-6 space-y-2 text-sm text-[var(--color-body)]">
              <li>계좌 1개 등록</li>
              <li>현재 달 포함 최근 3개월 조회</li>
              <li>카테고리별 지출 요약</li>
            </ul>
            {plan === "free" ? (
              <Badge variant="secondary" className="mt-6">
                현재 요금제
              </Badge>
            ) : null}
          </section>

          <section className="rounded-[var(--radius-xl)] bg-[var(--color-surface-dark)] p-8 text-[var(--color-on-dark)]">
            <p className="text-sm font-medium text-[var(--color-on-dark-soft)]">
              Pro
            </p>
            <p className="financial-number mt-3 text-3xl font-semibold">
              월 9,900원
            </p>
            <ul className="mt-6 space-y-2 text-sm text-[var(--color-on-dark-soft)]">
              <li>계좌 무제한 등록</li>
              <li>계좌별 전체 기간 조회</li>
              <li>이상거래 탐지 (예정)</li>
              <li>PDF/엑셀 내보내기 (예정)</li>
            </ul>
            {plan === "pro" ? (
              <form method="POST" action="/api/portal" className="mt-6">
                <Button
                  type="submit"
                  variant="outline"
                  className="h-11 border-white/30 bg-white text-[var(--color-ink)] hover:bg-white/90"
                >
                  구독 관리
                </Button>
              </form>
            ) : (
              <form method="POST" action="/api/checkout" className="mt-6">
                <Button type="submit" className="h-11 px-5">
                  Pro로 업그레이드
                </Button>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
