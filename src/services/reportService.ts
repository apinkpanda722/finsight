import type { SupabaseClient } from "@supabase/supabase-js"

import { withClockSkewRetry } from "@/lib/supabase/retry"
import {
  getMonthKey,
  summarizeByCategory,
  summarizeByMonth,
} from "@/services/dashboardInsightService"
import { buildCategoryReportPdf } from "@/services/reportPdfService"
import type { Database } from "@/types/supabase"

type ReportServiceDeps = {
  supabase: SupabaseClient<Database>
}

export class ReportAccessError extends Error {
  readonly code = "forbidden" as const

  constructor() {
    super("A Pro plan is required to generate reports")
    this.name = "ReportAccessError"
  }
}

export async function generateCategoryReportPdf(
  userId: string,
  deps: ReportServiceDeps
): Promise<Buffer> {
  const profileResult = await withClockSkewRetry(() =>
    deps.supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle()
  )

  if (profileResult.error) {
    throw new Error("프로필 정보를 불러올 수 없습니다.")
  }
  if (profileResult.data?.plan !== "pro") {
    throw new ReportAccessError()
  }

  const transactionsResult = await withClockSkewRetry(() =>
    deps.supabase
      .from("transactions")
      .select("amount, category, transaction_date")
  )

  if (transactionsResult.error) {
    throw new Error("거래 정보를 불러올 수 없습니다.")
  }

  const transactions = transactionsResult.data ?? []
  const currentMonth = getMonthKey()

  return buildCategoryReportPdf({
    categories: summarizeByCategory(transactions),
    monthly: summarizeByMonth(transactions),
    currentMonth,
    generatedAt: new Date(),
  })
}
