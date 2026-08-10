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
const ROW_HEIGHT = 24
const TEXT_COLOR = rgb(0.08, 0.09, 0.11)
const MUTED_COLOR = rgb(0.38, 0.4, 0.44)
const HAIRLINE_COLOR = rgb(0.86, 0.87, 0.89)

function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`
}

function formatGeneratedAt(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeZone: "Asia/Seoul",
  }).format(date)
}

function drawRightAlignedText(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number
): void {
  page.drawText(text, {
    x: PAGE_WIDTH - PAGE_MARGIN - font.widthOfTextAtSize(text, size),
    y,
    size,
    font,
    color: TEXT_COLOR,
  })
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

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - PAGE_MARGIN

  const addPage = (): void => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - PAGE_MARGIN
  }

  const ensureSpace = (height: number): void => {
    if (y - height < PAGE_MARGIN) addPage()
  }

  const drawSectionTitle = (title: string): void => {
    ensureSpace(42)
    page.drawText(title, {
      x: PAGE_MARGIN,
      y,
      size: 14,
      font: boldFont,
      color: TEXT_COLOR,
    })
    y -= 26
  }

  const drawTableHeader = (left: string, right: string): void => {
    ensureSpace(ROW_HEIGHT)
    page.drawText(left, {
      x: PAGE_MARGIN,
      y,
      size: 9,
      font: boldFont,
      color: MUTED_COLOR,
    })
    drawRightAlignedText(page, right, y, boldFont, 9)
    y -= 8
    page.drawLine({
      start: { x: PAGE_MARGIN, y },
      end: { x: PAGE_WIDTH - PAGE_MARGIN, y },
      thickness: 0.5,
      color: HAIRLINE_COLOR,
    })
    y -= 16
  }

  const drawTableRow = (left: string, right: string): void => {
    ensureSpace(ROW_HEIGHT)
    page.drawText(left, {
      x: PAGE_MARGIN,
      y,
      size: 10,
      font: regularFont,
      color: TEXT_COLOR,
    })
    drawRightAlignedText(page, right, y, regularFont, 10)
    y -= ROW_HEIGHT
  }

  page.drawText("Finsight 지출 리포트", {
    x: PAGE_MARGIN,
    y,
    size: 20,
    font: boldFont,
    color: TEXT_COLOR,
  })
  y -= 30
  page.drawText(`기준 월: ${input.currentMonth}`, {
    x: PAGE_MARGIN,
    y,
    size: 10,
    font: regularFont,
    color: MUTED_COLOR,
  })
  y -= 18
  page.drawText(`생성일: ${formatGeneratedAt(input.generatedAt)}`, {
    x: PAGE_MARGIN,
    y,
    size: 10,
    font: regularFont,
    color: MUTED_COLOR,
  })
  y -= 38

  drawSectionTitle("카테고리별 지출")
  drawTableHeader("카테고리", "금액")
  if (input.categories.length === 0) {
    drawTableRow("데이터 없음", "-")
  } else {
    for (const summary of input.categories) {
      drawTableRow(
        CATEGORY_LABELS[summary.category] ?? summary.category,
        formatWon(summary.total)
      )
    }
  }

  y -= 16
  drawSectionTitle("월별 추이")
  drawTableHeader("월", "금액")
  if (input.monthly.length === 0) {
    drawTableRow("데이터 없음", "-")
  } else {
    for (const summary of input.monthly) {
      drawTableRow(summary.month, formatWon(summary.total))
    }
  }

  return Buffer.from(await doc.save())
}
