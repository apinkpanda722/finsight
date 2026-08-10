import type { SupabaseClient } from "@supabase/supabase-js"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Database } from "@/types/supabase"

const reportPdfMocks = vi.hoisted(() => ({
  buildCategoryReportPdf: vi.fn(),
}))

vi.mock("@/services/reportPdfService", () => ({
  buildCategoryReportPdf: reportPdfMocks.buildCategoryReportPdf,
}))

import {
  generateCategoryReportPdf,
  ReportAccessError,
} from "./reportService"

type ReportTransaction = {
  amount: number
  category: string
  transaction_date: string
}

function createSupabase(
  plan: string,
  transactions: ReportTransaction[]
): {
  client: SupabaseClient<Database>
  from: ReturnType<typeof vi.fn>
} {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { plan },
    error: null,
  })
  const profileSelect = vi.fn(() => ({
    eq: vi.fn(() => ({ maybeSingle })),
  }))
  const transactionSelect = vi.fn().mockResolvedValue({
    data: transactions,
    error: null,
  })
  const from = vi.fn((table: string) => {
    if (table === "profiles") return { select: profileSelect }
    if (table === "transactions") return { select: transactionSelect }
    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("generateCategoryReportPdf", () => {
  it("rejects Free users before querying transactions", async () => {
    const supabase = createSupabase("free", [])

    await expect(
      generateCategoryReportPdf("user-id", { supabase: supabase.client })
    ).rejects.toBeInstanceOf(ReportAccessError)

    expect(supabase.from).not.toHaveBeenCalledWith("transactions")
    expect(reportPdfMocks.buildCategoryReportPdf).not.toHaveBeenCalled()
  })

  it("returns a PDF Buffer for Pro users using dashboard summaries", async () => {
    const pdf = Buffer.from("%PDF-report")
    const supabase = createSupabase("pro", [
      {
        amount: -12_000,
        category: "food_dining",
        transaction_date: "2026-08-01",
      },
      {
        amount: -3_000,
        category: "transport",
        transaction_date: "2026-08-02",
      },
      {
        amount: 50_000,
        category: "income",
        transaction_date: "2026-08-03",
      },
    ])
    reportPdfMocks.buildCategoryReportPdf.mockResolvedValue(pdf)

    const result = await generateCategoryReportPdf("user-id", {
      supabase: supabase.client,
    })

    expect(result).toBe(pdf)
    expect(reportPdfMocks.buildCategoryReportPdf).toHaveBeenCalledWith({
      categories: [
        { category: "food_dining", total: 12_000 },
        { category: "transport", total: 3_000 },
      ],
      monthly: [{ month: "2026-08", total: 15_000 }],
      currentMonth: expect.stringMatching(/^\d{4}-\d{2}$/),
      generatedAt: expect.any(Date),
    })
  })

  it("generates a PDF when the Pro user has no transactions", async () => {
    const pdf = Buffer.from("%PDF-empty-report")
    const supabase = createSupabase("pro", [])
    reportPdfMocks.buildCategoryReportPdf.mockResolvedValue(pdf)

    await expect(
      generateCategoryReportPdf("user-id", { supabase: supabase.client })
    ).resolves.toBe(pdf)
    expect(reportPdfMocks.buildCategoryReportPdf).toHaveBeenCalledWith(
      expect.objectContaining({ categories: [], monthly: [] })
    )
  })
})
