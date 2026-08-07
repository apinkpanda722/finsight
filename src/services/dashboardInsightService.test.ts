import { describe, expect, it } from "vitest"

import {
  getMonthKey,
  summarizeByCategory,
  summarizeByMonth,
} from "./dashboardInsightService"

const transactions = [
  {
    amount: -12_000,
    category: "food_dining",
    transaction_date: "2026-07-03",
  },
  {
    amount: -8_000,
    category: "food_dining",
    transaction_date: "2026-07-21",
  },
  {
    amount: -10_000,
    category: "utilities",
    transaction_date: "2026-08-02",
  },
  {
    amount: 100_000,
    category: "income",
    transaction_date: "2026-08-05",
  },
  {
    amount: -50_000,
    category: "transfer",
    transaction_date: "2026-08-06",
  },
  {
    amount: 2_000,
    category: "food_dining",
    transaction_date: "2026-08-07",
  },
]

describe("dashboard insight summaries", () => {
  it("derives the current calendar month in the requested time zone", () => {
    expect(
      getMonthKey(new Date("2026-07-31T15:30:00.000Z"), "Asia/Seoul")
    ).toBe("2026-08")
  })

  it("sums only negative expenses by category and excludes income and transfers", () => {
    expect(summarizeByCategory(transactions)).toEqual([
      { category: "food_dining", total: 20_000 },
      { category: "utilities", total: 10_000 },
    ])
  })

  it("sums only negative expenses by calendar month in ascending order", () => {
    expect(summarizeByMonth(transactions)).toEqual([
      { month: "2026-07", total: 20_000 },
      { month: "2026-08", total: 10_000 },
    ])
  })
})
