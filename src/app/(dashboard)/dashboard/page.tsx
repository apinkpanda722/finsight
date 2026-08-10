import { DashboardInsights } from "@/components/dashboard/dashboard-insights"
import { EmptyDashboardCard } from "@/components/dashboard/empty-dashboard-card"
import { requireUserId } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"
import { withClockSkewRetry } from "@/lib/supabase/retry"
import {
  getMonthKey,
  summarizeByCategory,
  summarizeByMonth,
} from "@/services/dashboardInsightService"

export default async function DashboardPage() {
  const userId = await requireUserId()
  const supabase = await createClient()
  const [profileResult, lockedHistoryResult] = await Promise.all([
    withClockSkewRetry(() =>
      supabase.from("profiles").select("plan").eq("id", userId).maybeSingle()
    ),
    withClockSkewRetry(() => supabase.rpc("has_locked_history")),
  ])

  if (profileResult.error || lockedHistoryResult.error) {
    console.error("dashboard query failed", {
      profileErrorCode: profileResult.error?.code,
      lockedHistoryErrorCode: lockedHistoryResult.error?.code,
    })
    throw new Error("대시보드 정보를 불러올 수 없습니다.")
  }

  const transactionsResult = await withClockSkewRetry(() =>
    supabase
      .from("transactions")
      .select("amount, category, transaction_date")
      .order("transaction_date", { ascending: true })
  )

  if (transactionsResult.error) {
    throw new Error("거래 정보를 불러올 수 없습니다.")
  }

  const transactions = transactionsResult.data ?? []

  if (transactions.length === 0) {
    return <EmptyDashboardCard />
  }

  return (
    <main className="p-6 sm:p-10">
      <div className="mx-auto max-w-[var(--container-max)]">
        <header className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">개요</p>
          <h1 className="mt-2 font-heading text-4xl font-normal tracking-[-0.03em]">
            지출 인사이트
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-body)]">
            카테고리별 지출과 월별 흐름입니다.
          </p>
        </header>

        <DashboardInsights
          categories={summarizeByCategory(transactions)}
          monthly={summarizeByMonth(transactions)}
          currentMonth={getMonthKey()}
          plan={profileResult.data?.plan === "pro" ? "pro" : "free"}
          hasLockedHistory={lockedHistoryResult.data === true}
        />
      </div>
    </main>
  )
}
