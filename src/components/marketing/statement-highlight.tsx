"use client"

import { useState } from "react"

import { CARD_HOVER_CLASS, SAMPLE_TRANSACTIONS } from "@/components/marketing/sample-preview"
import { Badge } from "@/components/ui/badge"
import {
  summarizeByCategory,
  summarizeByMonth,
} from "@/services/dashboardInsightService"
import { CATEGORY_LABELS } from "@/types/domain"

const RAW_CSV_ROWS = [
  { date: "2026-06-03", merchant: "이탈리안 레스토랑", amount: -180_000 },
  { date: "2026-06-14", merchant: "스타벅스 강남점", amount: -95_000 },
  { date: "2026-06-05", merchant: "이마트", amount: -120_000 },
  { date: "2026-06-08", merchant: "지하철 2호선", amount: -60_000 },
  { date: "2026-06-19", merchant: "쿠팡", amount: -140_000 },
] as const

type TabId = "category" | "monthly"

function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`
}

function formatMonthLabel(month: string): string {
  return `${Number(month.slice(5))}월`
}

export function StatementHighlight() {
  const [activeTab, setActiveTab] = useState<TabId>("category")

  const categories = summarizeByCategory(SAMPLE_TRANSACTIONS)
  const monthly = summarizeByMonth(SAMPLE_TRANSACTIONS)
  const topCategory = categories[0]
  const [peakMonth] = [...monthly].sort((a, b) => b.total - a.total)
  const topCategoryLabel =
    CATEGORY_LABELS[topCategory.category] ?? topCategory.category
  const peakMonthLabel = formatMonthLabel(peakMonth.month)

  const tabs: Array<{
    id: TabId
    label: string
    caption: string
    value: string
    description: string
  }> = [
    {
      id: "category",
      label: "카테고리 톱",
      caption: `가장 큰 지출 카테고리 · ${topCategoryLabel}`,
      value: formatWon(topCategory.total),
      description: `전체 ${categories.length}개 카테고리 중 ${topCategoryLabel} 지출이 가장 큽니다.`,
    },
    {
      id: "monthly",
      label: "월별 추이",
      caption: `지출이 가장 많았던 달 · ${peakMonthLabel}`,
      value: formatWon(peakMonth.total),
      description: `${monthly.length}개월 데이터 중 ${peakMonthLabel} 지출이 가장 많았습니다.`,
    },
  ]

  const active = tabs.find((tab) => tab.id === activeTab)!

  return (
    <section className="overflow-hidden bg-[var(--color-surface-dark)] text-[var(--color-on-dark)]">
      <div className="mx-auto max-w-(--container-max) px-6 py-24 sm:px-8">
        <Badge
          variant="secondary"
          className="bg-white/10 text-[var(--color-on-dark)]"
        >
          명세서 분석
        </Badge>
        <h2 className="mt-4 max-w-[680px] font-heading text-4xl leading-tight font-normal tracking-[-0.025em] text-balance sm:text-[44px]">
          같은 명세서에서 finsight가 무엇을 정리하는지 보여드립니다
        </h2>
        <p className="mt-4 max-w-[560px] text-base leading-7 text-[var(--color-on-dark-soft)]">
          raw_statement.csv를 업로드하면 거래 단위로 나눠 카테고리별 지출과
          월별 추이로 정리합니다.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:items-start">
          <div
            data-slot="card"
            className={`rounded-[var(--radius-xl)] border border-white/10 bg-[var(--color-surface-dark-elevated)] p-6 ${CARD_HOVER_CLASS}`}
          >
            <p className="financial-number text-sm text-[var(--color-on-dark-soft)]">
              raw_statement.csv
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-[var(--color-on-dark-soft)]">
                    <th className="py-3 pr-3 font-normal">날짜</th>
                    <th className="py-3 pr-3 font-normal">가맹점</th>
                    <th className="py-3 pl-3 text-right font-normal">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {RAW_CSV_ROWS.map((row) => (
                    <tr
                      key={row.merchant}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="financial-number py-3 pr-3 text-[var(--color-on-dark-soft)]">
                        {row.date}
                      </td>
                      <td className="py-3 pr-3">{row.merchant}</td>
                      <td className="financial-number py-3 pl-3 text-right">
                        {formatWon(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div
            data-slot="card"
            className={`relative rounded-[var(--radius-xl)] bg-[var(--color-surface-dark-elevated)] p-6 shadow-[var(--shadow-glow-primary)] ${CARD_HOVER_CLASS}`}
          >
            <p className="text-sm font-semibold">finsight가 정리한 결과</p>

            <div
              role="tablist"
              aria-label="정리된 결과 종류"
              className="mt-4 inline-flex gap-1 rounded-full bg-white/5 p-1"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={
                    activeTab === tab.id
                      ? "rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                      : "rounded-full px-4 py-2 text-sm text-[var(--color-on-dark-soft)] transition-colors hover:text-[var(--color-on-dark)]"
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <p className="text-sm text-[var(--color-on-dark-soft)]">
                {active.caption}
              </p>
              <p className="financial-number mt-3 text-4xl font-medium tracking-[-0.03em] sm:text-[44px]">
                {active.value}
              </p>
              <p className="mt-4 text-sm leading-6 text-[var(--color-on-dark-soft)]">
                {active.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
