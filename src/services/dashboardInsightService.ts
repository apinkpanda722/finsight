export type InsightTransaction = {
  amount: number
  category: string
  transaction_date: string
}

export type CategorySummary = {
  category: string
  total: number
}

export type MonthSummary = {
  month: string
  total: number
}

const NON_EXPENSE_CATEGORIES = new Set(["income", "transfer"])

function isExpense(transaction: InsightTransaction): boolean {
  return (
    transaction.amount < 0 &&
    !NON_EXPENSE_CATEGORIES.has(transaction.category)
  )
}

export function summarizeByCategory(
  transactions: InsightTransaction[]
): CategorySummary[] {
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    if (!isExpense(transaction)) continue

    totals.set(
      transaction.category,
      (totals.get(transaction.category) ?? 0) + Math.abs(transaction.amount)
    )
  }

  return Array.from(totals, ([category, total]) => ({ category, total })).sort(
    (left, right) =>
      right.total - left.total || left.category.localeCompare(right.category)
  )
}

export function summarizeByMonth(
  transactions: InsightTransaction[]
): MonthSummary[] {
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    if (!isExpense(transaction)) continue

    const month = transaction.transaction_date.slice(0, 7)
    totals.set(month, (totals.get(month) ?? 0) + Math.abs(transaction.amount))
  }

  return Array.from(totals, ([month, total]) => ({ month, total })).sort(
    (left, right) => left.month.localeCompare(right.month)
  )
}

export function getMonthKey(
  date: Date = new Date(),
  timeZone = "Asia/Seoul"
): string {
  const parts = new Intl.DateTimeFormat("en", {
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value

  if (!year || !month) {
    throw new Error("현재 월을 계산할 수 없습니다.")
  }

  return `${year}-${month}`
}
