import fs from "node:fs"
import path from "node:path"

import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib"

import type {
  CategorySummary,
  MonthSummary,
} from "@/services/dashboardInsightService"
import { CATEGORY_LABELS } from "@/types/domain"

export type ReportSummaryInput = {
  categories: CategorySummary[]
  monthly: MonthSummary[]
  currentMonth: string
  generatedAt: Date
}

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const PAGE_MARGIN = 48
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const CARD_GAP = 16
const CARD_HEIGHT = 72
const CHART_HEIGHT = 120
const TILE_GAP = 12

// Mirrors the design tokens in src/app/globals.css so the report reads as
// an extension of the dashboard rather than a generic document.
const COLOR_INK = rgb(0.0549, 0.0627, 0.0745) // --color-ink
const COLOR_BODY = rgb(0.3569, 0.3804, 0.4118) // --color-body
const COLOR_MUTED = rgb(0.4863, 0.5098, 0.5412) // --color-muted
const COLOR_PRIMARY = rgb(0.1098, 0.3059, 0.8471) // --color-primary
const COLOR_HAIRLINE = rgb(0.8745, 0.8863, 0.9059) // --color-hairline
const COLOR_SURFACE_STRONG = rgb(0.9333, 0.9412, 0.9529) // --color-surface-strong
const COLOR_UP = rgb(0.0902, 0.6549, 0.4078) // --color-semantic-up
const COLOR_DOWN = rgb(0.8392, 0.2235, 0.2902) // --color-semantic-down
const COLOR_WHITE = rgb(1, 1, 1)

function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`
}

function formatGeneratedAt(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeZone: "Asia/Seoul",
  }).format(date)
}

function formatMonthTile(month: string): string {
  return month.replace("-", ".")
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

type ReportContext = {
  doc: PDFDocument
  regularFont: PDFFont
  boldFont: PDFFont
  page: PDFPage
  y: number
}

function addPage(ctx: ReportContext): void {
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  ctx.y = PAGE_HEIGHT - PAGE_MARGIN
}

function ensureSpace(ctx: ReportContext, height: number): void {
  if (ctx.y - height < PAGE_MARGIN) addPage(ctx)
}

function drawRightAlignedText(
  page: PDFPage,
  text: string,
  rightEdge: number,
  y: number,
  font: PDFFont,
  size: number,
  color = COLOR_INK
): void {
  page.drawText(text, {
    x: rightEdge - font.widthOfTextAtSize(text, size),
    y,
    size,
    font,
    color,
  })
}

function drawSectionTitle(ctx: ReportContext, title: string): void {
  ensureSpace(ctx, 34)
  ctx.page.drawText(title, {
    x: PAGE_MARGIN,
    y: ctx.y,
    size: 14,
    font: ctx.boldFont,
    color: COLOR_INK,
  })
  ctx.y -= 26
}

// Mirrors the "이번 달 총 지출" / "전월 대비" stat cards at the top of
// DashboardInsights.
function drawSummaryCards(
  ctx: ReportContext,
  currentTotal: number,
  change: number | null
): void {
  ensureSpace(ctx, CARD_HEIGHT + 20)

  const cardWidth = (CONTENT_WIDTH - CARD_GAP) / 2
  const top = ctx.y
  const bottom = top - CARD_HEIGHT
  const changeColor =
    change === null ? COLOR_MUTED : change >= 0 ? COLOR_UP : COLOR_DOWN
  const changeText =
    change === null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`

  const cards: Array<{ x: number; label: string; value: string; color: typeof COLOR_INK }> = [
    { x: PAGE_MARGIN, label: "이번 달 총 지출", value: formatWon(currentTotal), color: COLOR_INK },
    { x: PAGE_MARGIN + cardWidth + CARD_GAP, label: "전월 대비", value: changeText, color: changeColor },
  ]

  for (const card of cards) {
    ctx.page.drawRectangle({
      x: card.x,
      y: bottom,
      width: cardWidth,
      height: CARD_HEIGHT,
      color: COLOR_WHITE,
      borderColor: COLOR_HAIRLINE,
      borderWidth: 1,
    })
    ctx.page.drawText(card.label, {
      x: card.x + 16,
      y: top - 24,
      size: 9,
      font: ctx.regularFont,
      color: COLOR_MUTED,
    })
    ctx.page.drawText(card.value, {
      x: card.x + 16,
      y: top - 50,
      size: 20,
      font: ctx.boldFont,
      color: card.color,
    })
  }

  ctx.y = bottom - 20
}

// Mirrors CategoryBar in DashboardInsights: label + amount above a
// track/fill progress bar sized relative to the largest category.
function drawCategoryBreakdown(
  ctx: ReportContext,
  categories: CategorySummary[]
): void {
  drawSectionTitle(ctx, "카테고리별 지출")

  if (categories.length === 0) {
    ensureSpace(ctx, 20)
    ctx.page.drawText("데이터 없음", {
      x: PAGE_MARGIN,
      y: ctx.y,
      size: 10,
      font: ctx.regularFont,
      color: COLOR_MUTED,
    })
    ctx.y -= 28
    return
  }

  const maximum = Math.max(0, ...categories.map((summary) => summary.total))

  for (const summary of categories) {
    ensureSpace(ctx, 36)
    const label = CATEGORY_LABELS[summary.category] ?? summary.category
    const amountText = formatWon(summary.total)
    const percentage = maximum > 0 ? summary.total / maximum : 0

    ctx.page.drawText(label, {
      x: PAGE_MARGIN,
      y: ctx.y,
      size: 11,
      font: ctx.regularFont,
      color: COLOR_INK,
    })
    drawRightAlignedText(
      ctx.page,
      amountText,
      PAGE_WIDTH - PAGE_MARGIN,
      ctx.y,
      ctx.boldFont,
      11
    )

    const trackY = ctx.y - 14
    ctx.page.drawRectangle({
      x: PAGE_MARGIN,
      y: trackY,
      width: CONTENT_WIDTH,
      height: 6,
      color: COLOR_SURFACE_STRONG,
    })
    ctx.page.drawRectangle({
      x: PAGE_MARGIN,
      y: trackY,
      width: Math.max(4, CONTENT_WIDTH * percentage),
      height: 6,
      color: COLOR_PRIMARY,
    })

    ctx.y -= 36
  }

  ctx.y -= 4
}

// Mirrors MonthlyLineTrend in DashboardInsights: a connected-line chart
// followed by a 2-column grid of month tiles.
function drawMonthlyTrend(ctx: ReportContext, monthly: MonthSummary[]): void {
  drawSectionTitle(ctx, "월별 추이")

  if (monthly.length === 0) {
    ensureSpace(ctx, 20)
    ctx.page.drawText("데이터 없음", {
      x: PAGE_MARGIN,
      y: ctx.y,
      size: 10,
      font: ctx.regularFont,
      color: COLOR_MUTED,
    })
    ctx.y -= 28
    return
  }

  ensureSpace(ctx, CHART_HEIGHT + 16)
  const chartTop = ctx.y
  const chartBottom = chartTop - CHART_HEIGHT
  const maximum = Math.max(1, ...monthly.map((month) => month.total))
  const usableHeight = CHART_HEIGHT - 16
  const stepX =
    monthly.length > 1 ? CONTENT_WIDTH / (monthly.length - 1) : 0

  const points = monthly.map((month, index) => ({
    x:
      PAGE_MARGIN +
      (monthly.length > 1 ? stepX * index : CONTENT_WIDTH / 2),
    y: chartBottom + 8 + (month.total / maximum) * usableHeight,
  }))

  for (let index = 1; index < points.length; index += 1) {
    ctx.page.drawLine({
      start: points[index - 1],
      end: points[index],
      thickness: 2,
      color: COLOR_PRIMARY,
    })
  }
  for (const point of points) {
    ctx.page.drawCircle({
      x: point.x,
      y: point.y,
      size: 3.5,
      color: COLOR_PRIMARY,
    })
  }

  ctx.y = chartBottom - 20

  const tileWidth = (CONTENT_WIDTH - TILE_GAP) / 2
  const tileHeight = 44

  for (let index = 0; index < monthly.length; index += 1) {
    const column = index % 2
    if (column === 0) ensureSpace(ctx, tileHeight + 8)

    const tileX = PAGE_MARGIN + column * (tileWidth + TILE_GAP)
    const tileTop = ctx.y
    const month = monthly[index]

    ctx.page.drawRectangle({
      x: tileX,
      y: tileTop - tileHeight,
      width: tileWidth,
      height: tileHeight,
      color: COLOR_SURFACE_STRONG,
    })
    ctx.page.drawText(formatMonthTile(month.month), {
      x: tileX + 12,
      y: tileTop - 18,
      size: 9,
      font: ctx.regularFont,
      color: COLOR_MUTED,
    })
    ctx.page.drawText(formatWon(month.total), {
      x: tileX + 12,
      y: tileTop - 34,
      size: 11,
      font: ctx.boldFont,
      color: COLOR_INK,
    })

    if (column === 1 || index === monthly.length - 1) {
      ctx.y -= tileHeight + 8
    }
  }
}

export async function buildCategoryReportPdf(
  input: ReportSummaryInput
): Promise<Buffer> {
  const regularBytes = new Uint8Array(
    fs.readFileSync(
      path.join(process.cwd(), "src/assets/fonts/NanumGothic-Regular.ttf")
    )
  )
  const boldBytes = new Uint8Array(
    fs.readFileSync(
      path.join(process.cwd(), "src/assets/fonts/NanumGothic-Bold.ttf")
    )
  )

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const regularFont = await doc.embedFont(regularBytes, { subset: false })
  const boldFont = await doc.embedFont(boldBytes, { subset: false })

  const ctx: ReportContext = {
    doc,
    regularFont,
    boldFont,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - PAGE_MARGIN,
  }

  ctx.page.drawText("Finsight 지출 리포트", {
    x: PAGE_MARGIN,
    y: ctx.y,
    size: 20,
    font: boldFont,
    color: COLOR_INK,
  })
  ctx.y -= 30
  ctx.page.drawText(`기준 월: ${input.currentMonth}`, {
    x: PAGE_MARGIN,
    y: ctx.y,
    size: 10,
    font: regularFont,
    color: COLOR_BODY,
  })
  ctx.y -= 18
  ctx.page.drawText(`생성일: ${formatGeneratedAt(input.generatedAt)}`, {
    x: PAGE_MARGIN,
    y: ctx.y,
    size: 10,
    font: regularFont,
    color: COLOR_BODY,
  })
  ctx.y -= 34

  const currentTotal =
    input.monthly.find((summary) => summary.month === input.currentMonth)
      ?.total ?? 0
  const previousTotal =
    input.monthly.find(
      (summary) => summary.month === shiftMonth(input.currentMonth, -1)
    )?.total ?? 0
  const change =
    previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : null

  drawSummaryCards(ctx, currentTotal, change)
  drawCategoryBreakdown(ctx, input.categories)
  drawMonthlyTrend(ctx, input.monthly)

  return Buffer.from(await doc.save())
}
