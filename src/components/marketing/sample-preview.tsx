import { Badge } from "@/components/ui/badge"
import {
  CategoryBar,
  MonthlyLineTrend,
} from "@/components/dashboard/dashboard-insights"
import {
  summarizeByCategory,
  summarizeByMonth,
  type InsightTransaction,
} from "@/services/dashboardInsightService"

export const SAMPLE_TRANSACTIONS: InsightTransaction[] = [
  { amount: -180_000, category: "food_dining", transaction_date: "2026-06-03" },
  { amount: -95_000, category: "food_dining", transaction_date: "2026-06-14" },
  { amount: -120_000, category: "groceries", transaction_date: "2026-06-05" },
  { amount: -60_000, category: "transport", transaction_date: "2026-06-08" },
  { amount: -140_000, category: "shopping", transaction_date: "2026-06-19" },
  { amount: -90_000, category: "utilities", transaction_date: "2026-06-25" },
  { amount: -160_000, category: "food_dining", transaction_date: "2026-07-04" },
  { amount: -110_000, category: "food_dining", transaction_date: "2026-07-21" },
  { amount: -130_000, category: "groceries", transaction_date: "2026-07-11" },
  { amount: -70_000, category: "transport", transaction_date: "2026-07-09" },
  { amount: -310_000, category: "shopping", transaction_date: "2026-07-16" },
  { amount: -140_000, category: "shopping", transaction_date: "2026-07-27" },
  { amount: -120_000, category: "entertainment", transaction_date: "2026-07-19" },
  { amount: -95_000, category: "utilities", transaction_date: "2026-07-25" },
  { amount: -175_000, category: "food_dining", transaction_date: "2026-08-02" },
  { amount: -125_000, category: "food_dining", transaction_date: "2026-08-13" },
  { amount: -150_000, category: "groceries", transaction_date: "2026-08-06" },
  { amount: -85_000, category: "transport", transaction_date: "2026-08-10" },
  { amount: -180_000, category: "shopping", transaction_date: "2026-08-17" },
  { amount: -92_000, category: "utilities", transaction_date: "2026-08-24" },
  { amount: -45_000, category: "subscriptions", transaction_date: "2026-08-21" },
]

const CARD_HOVER_CLASS =
  "transition-transform duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02]"

function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      data-slot="card"
      className={`rounded-[var(--radius-xl)] border border-border bg-background p-6 ${CARD_HOVER_CLASS}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="financial-number mt-2 text-3xl font-medium tracking-[-0.04em]">
        {value}
      </p>
    </div>
  )
}

export function SamplePreview() {
  const categories = summarizeByCategory(SAMPLE_TRANSACTIONS)
  const monthly = summarizeByMonth(SAMPLE_TRANSACTIONS)
  const totalSpend = categories.reduce((sum, summary) => sum + summary.total, 0)
  const maximumCategory = Math.max(0, ...categories.map((summary) => summary.total))

  return (
    <section className="mx-auto max-w-(--container-max) px-6 py-24 sm:px-8">
      <Badge variant="secondary">샘플 명세서</Badge>
      <h2 className="mt-4 max-w-[680px] font-heading text-4xl leading-tight font-normal tracking-[-0.025em] sm:text-[44px]">
        가입 전에 분석 결과를 먼저 확인하세요.
      </h2>
      <p className="mt-4 max-w-[560px] text-base leading-7 text-muted-foreground">
        샘플 카드 명세서를 업로드했을 때 finsight가 보여주는 카테고리별 지출과
        월별 추이입니다.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <StatTile label="거래 수" value={`${SAMPLE_TRANSACTIONS.length}건`} />
        <StatTile label="샘플 지출" value={formatWon(totalSpend)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section
          data-slot="card"
          className={`rounded-[var(--radius-xl)] border border-border bg-background p-6 ${CARD_HOVER_CLASS}`}
        >
          <h3 className="mb-5 font-heading text-lg font-semibold">
            카테고리별 지출
          </h3>
          {categories.map((summary) => (
            <CategoryBar
              key={summary.category}
              summary={summary}
              maximum={maximumCategory}
            />
          ))}
        </section>

        <section
          data-slot="card"
          className={`rounded-[var(--radius-xl)] border border-border bg-background p-6 ${CARD_HOVER_CLASS}`}
        >
          <MonthlyLineTrend monthly={monthly} title="월별 지출 추이" />
        </section>
      </div>
    </section>
  )
}
