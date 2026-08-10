import Link from "next/link"

import { DashboardInsights } from "@/components/dashboard/dashboard-insights"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { requireUserId } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"
import { withClockSkewRetry } from "@/lib/supabase/retry"
import {
  getMonthKey,
  summarizeByCategory,
  summarizeByMonth,
} from "@/services/dashboardInsightService"

type DashboardPageProps = {
  searchParams?: Promise<{
    account?: string | string[]
  }>
}

function EmptyDashboard() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 sm:p-10">
      <Card className="w-full max-w-[640px] border-border text-center shadow-none">
        <CardContent className="flex flex-col items-center p-10 sm:p-14">
          <span className="flex size-14 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-sm font-semibold">
            파일
          </span>
          <h1 className="mt-6 font-heading text-3xl font-normal tracking-[-0.02em]">
            아직 업로드한 명세서가 없어요.
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            첫 CSV/PDF를 업로드해보세요
          </p>
          <Button asChild className="mt-8 h-12 px-6 text-base">
            <Link href="/uploads?upload=1">CSV/PDF 업로드하기</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps = {}) {
  const userId = await requireUserId()
  const supabase = await createClient()
  const [profileResult, accountsResult, lockedHistoryResult] = await Promise.all([
    withClockSkewRetry(() =>
      supabase.from("profiles").select("plan").eq("id", userId).maybeSingle()
    ),
    withClockSkewRetry(() =>
      supabase.from("accounts").select("id, label").order("created_at", {
        ascending: true,
      })
    ),
    withClockSkewRetry(() => supabase.rpc("has_locked_history")),
  ])

  if (
    profileResult.error ||
    accountsResult.error ||
    lockedHistoryResult.error
  ) {
    throw new Error("대시보드 정보를 불러올 수 없습니다.")
  }

  const accounts = accountsResult.data ?? []
  const requestedAccount = (await searchParams)?.account
  const requestedAccountId =
    typeof requestedAccount === "string" ? requestedAccount : null
  const activeAccount =
    accounts.find((account) => account.id === requestedAccountId) ?? accounts[0]

  if (!activeAccount) {
    return <EmptyDashboard />
  }

  const transactionsResult = await withClockSkewRetry(() =>
    supabase
      .from("transactions")
      .select(
        "amount, category, transaction_date, uploaded_statements!inner(account_id)"
      )
      .eq("uploaded_statements.account_id", activeAccount.id)
      .order("transaction_date", { ascending: true })
  )

  if (transactionsResult.error) {
    throw new Error("거래 정보를 불러올 수 없습니다.")
  }

  const transactions = transactionsResult.data ?? []

  if (transactions.length === 0) {
    return <EmptyDashboard />
  }

  return (
    <main className="p-6 sm:p-10">
      <div className="mx-auto max-w-[var(--container-max)]">
        <header className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">개요</p>
          <h1 className="mt-2 font-heading text-4xl font-normal tracking-[-0.03em]">
            {activeAccount.label} 지출 인사이트
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-body)]">
            선택한 계좌의 카테고리별 지출과 월별 흐름입니다.
          </p>
        </header>

        <DashboardInsights
          accounts={accounts}
          activeAccountId={activeAccount.id}
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
