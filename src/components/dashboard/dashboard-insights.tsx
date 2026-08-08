import Link from "next/link"

import type { Plan } from "@/components/dashboard/plan-badge"
import { Button } from "@/components/ui/button"
import type {
  CategorySummary,
  MonthSummary,
} from "@/services/dashboardInsightService"

type Account = {
  id: string
  label: string
}

type DashboardInsightsProps = {
  accounts: Account[]
  activeAccountId: string
  categories: CategorySummary[]
  monthly: MonthSummary[]
  currentMonth: string
  plan: Plan
  hasLockedHistory: boolean
}

type TrendMonth = MonthSummary & {
  current: boolean
  locked: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  food_dining: "식비",
  groceries: "장보기",
  transport: "교통",
  shopping: "쇼핑",
  entertainment: "여가",
  utilities: "공과금",
  housing: "주거",
  healthcare: "의료",
  education: "교육",
  travel: "여행",
  subscriptions: "구독",
  income: "수입",
  transfer: "이체",
  fees: "수수료",
  other: "기타",
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`
}

function formatMonth(month: string): string {
  return `${Number(month.slice(5))}월`
}

function formatMonthTile(month: string): string {
  return month.replace("-", ".")
}

const LINE_CHART_WIDTH = 560
const LINE_CHART_HEIGHT = 160
const LINE_CHART_PADDING_X = 24
const LINE_CHART_PADDING_TOP = 20
const LINE_CHART_PADDING_BOTTOM = 8

function createLockedTrendMonths(
  monthly: MonthSummary[],
  currentMonth: string
): TrendMonth[] {
  const totals = new Map(monthly.map((summary) => [summary.month, summary.total]))

  return Array.from({ length: 12 }, (_, index) => {
    const offset = index - 11
    const month = shiftMonth(currentMonth, offset)
    const locked = offset < -2

    return {
      month,
      total: locked ? 0 : (totals.get(month) ?? 0),
      current: offset === 0,
      locked,
    }
  })
}

function LockedMark() {
  return (
    <span
      aria-hidden="true"
      className="relative block h-2.5 w-3 rounded-[2px] border border-[var(--color-muted)] before:absolute before:-top-1.5 before:left-0.5 before:h-1.5 before:w-1.5 before:rounded-t-full before:border before:border-b-0 before:border-[var(--color-muted)]"
    />
  )
}

function AccountChips({
  accounts,
  activeAccountId,
}: Pick<DashboardInsightsProps, "accounts" | "activeAccountId">) {
  if (accounts.length <= 1) return null

  return (
    <nav aria-label="계좌 선택" className="mb-6 flex flex-wrap gap-2">
      {accounts.map((account) => {
        const active = account.id === activeAccountId

        return (
          <Link
            key={account.id}
            href={`/dashboard?account=${encodeURIComponent(account.id)}`}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-on-dark)]"
                : "rounded-full bg-[var(--color-surface-strong)] px-4 py-2 text-sm text-foreground transition-colors hover:bg-[var(--color-hairline)]"
            }
          >
            {account.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function CategoryBar({
  summary,
  maximum,
}: {
  summary: CategorySummary
  maximum: number
}) {
  const percentage = maximum > 0 ? (summary.total / maximum) * 100 : 0

  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between gap-4">
        <span className="text-base">
          {CATEGORY_LABELS[summary.category] ?? summary.category}
        </span>
        <span className="financial-number text-base font-medium">
          {formatWon(summary.total)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-strong)]">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export function MonthlyLineTrend({
  monthly,
  title,
}: {
  monthly: MonthSummary[]
  title: string
}) {
  const maximum = Math.max(1, ...monthly.map((month) => month.total))
  const stepX =
    monthly.length > 1
      ? (LINE_CHART_WIDTH - LINE_CHART_PADDING_X * 2) / (monthly.length - 1)
      : 0
  const points = monthly.map((month, index) => ({
    ...month,
    x: LINE_CHART_PADDING_X + stepX * index,
    y:
      LINE_CHART_PADDING_TOP +
      (LINE_CHART_HEIGHT - LINE_CHART_PADDING_TOP - LINE_CHART_PADDING_BOTTOM) *
        (1 - month.total / maximum),
  }))
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ")
  const latest = monthly[monthly.length - 1]

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            월별 지출 흐름을 비교합니다.
          </p>
        </div>
        {latest ? (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">최근 기간</p>
            <p className="financial-number mt-1 text-lg font-medium">
              {formatWon(latest.total)}
            </p>
          </div>
        ) : null}
      </div>

      <div role="img" aria-label="월별 지출 추이">
        <svg
          viewBox={`0 0 ${LINE_CHART_WIDTH} ${LINE_CHART_HEIGHT}`}
          preserveAspectRatio="none"
          className="h-[160px] w-full"
        >
          <polyline
            points={linePoints}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
          />
          {points.map((point) => (
            <circle
              key={point.month}
              data-month-point
              cx={point.x}
              cy={point.y}
              r={5}
              fill="var(--color-primary)"
            />
          ))}
        </svg>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {monthly.map((month) => (
          <div
            key={month.month}
            className="rounded-[var(--radius-md)] bg-[var(--color-surface-strong)] p-4"
          >
            <p className="financial-number text-xs text-muted-foreground">
              {formatMonthTile(month.month)}
            </p>
            <p className="financial-number mt-1 text-base font-semibold">
              {formatWon(month.total)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthlyTrend({
  monthly,
  currentMonth,
  plan,
}: Pick<DashboardInsightsProps, "monthly" | "currentMonth" | "plan">) {
  if (plan === "pro") {
    return (
      <section className="rounded-[var(--radius-xl)] border border-border bg-background p-6">
        <MonthlyLineTrend monthly={monthly} title="월별 추이" />
      </section>
    )
  }

  const months = createLockedTrendMonths(monthly, currentMonth)
  const maximum = Math.max(0, ...months.map((month) => month.total))

  return (
    <section className="rounded-[var(--radius-xl)] border border-border bg-background p-6">
      <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <h2 className="font-heading text-lg font-semibold">월별 추이</h2>
        <p className="text-xs text-muted-foreground">
          현재 달 포함 최근 3개월만 표시됩니다
        </p>
      </div>

      <div
        role="img"
        aria-label="월별 지출 추이"
        className="overflow-x-auto pb-1"
      >
        <div className="flex h-[180px] min-w-[560px] items-end gap-3">
          {months.map((month) => {
            const height = month.locked
              ? 28
              : maximum > 0
                ? Math.max(8, Math.round((month.total / maximum) * 144))
                : 8
            const accessibleLabel = month.locked
              ? `${month.month} 잠김`
              : `${month.month} ${formatWon(month.total)}`

            return (
              <div
                key={month.month}
                aria-label={accessibleLabel}
                className="flex min-w-8 flex-1 flex-col items-center gap-2"
              >
                <div className="flex h-36 w-full items-end justify-center">
                  <div
                    data-month-bar
                    className={
                      month.locked
                        ? "relative w-3/5 rounded-t-md bg-[var(--color-hairline)]"
                        : month.current
                          ? "w-3/5 rounded-t-md bg-primary"
                          : "w-3/5 rounded-t-md bg-[var(--color-surface-dark-elevated)]"
                    }
                    style={{ height }}
                  >
                    {month.locked ? (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2">
                        <LockedMark />
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="financial-number text-xs text-muted-foreground">
                  {formatMonth(month.month)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function DashboardInsights({
  accounts,
  activeAccountId,
  categories,
  monthly,
  currentMonth,
  plan,
  hasLockedHistory,
}: DashboardInsightsProps) {
  const currentTotal =
    monthly.find((summary) => summary.month === currentMonth)?.total ?? 0
  const previousTotal =
    monthly.find((summary) => summary.month === shiftMonth(currentMonth, -1))
      ?.total ?? 0
  const change =
    previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : null
  const maximumCategory = Math.max(
    0,
    ...categories.map((summary) => summary.total)
  )

  return (
    <div>
      <AccountChips
        accounts={accounts}
        activeAccountId={activeAccountId}
      />

      {hasLockedHistory ? (
        <aside className="mb-6 flex flex-col justify-between gap-4 rounded-[var(--radius-xl)] border border-border bg-background p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-heading text-base font-semibold">
              3개월 이전 데이터도 있어요
            </p>
            <p className="mt-1 text-sm text-[var(--color-body)]">
              Pro로 업그레이드하면 전체 히스토리를 볼 수 있습니다.
            </p>
          </div>
          <Button asChild className="h-10 px-5">
            <Link href="/settings/billing">Pro로 업그레이드</Link>
          </Button>
        </aside>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-[var(--radius-xl)] border border-border bg-background p-6">
          <p className="text-xs text-muted-foreground">이번 달 총 지출</p>
          <p className="financial-number mt-2 text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
            {formatWon(currentTotal)}
          </p>
        </section>
        <section className="rounded-[var(--radius-xl)] border border-border bg-background p-6">
          <p className="text-xs text-muted-foreground">전월 대비</p>
          <p
            className="financial-number mt-2 text-3xl font-medium tracking-[-0.04em] sm:text-4xl"
            style={{
              color:
                change === null
                  ? "var(--color-muted)"
                  : change >= 0
                    ? "var(--color-semantic-up)"
                    : "var(--color-semantic-down)",
            }}
          >
            {change === null
              ? "—"
              : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
          </p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[var(--radius-xl)] border border-border bg-background p-6">
          <h2 className="mb-5 font-heading text-lg font-semibold">
            카테고리별 지출
          </h2>
          {categories.length > 0 ? (
            categories.map((summary) => (
              <CategoryBar
                key={summary.category}
                summary={summary}
                maximum={maximumCategory}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              표시할 지출 거래가 없습니다.
            </p>
          )}
        </section>

        <MonthlyTrend
          monthly={monthly}
          currentMonth={currentMonth}
          plan={plan}
        />
      </div>
    </div>
  )
}
