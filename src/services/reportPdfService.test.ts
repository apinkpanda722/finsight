import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { describe, expect, it } from "vitest"

import { buildCategoryReportPdf } from "./reportPdfService"

async function extractText(pdf: Buffer): Promise<string> {
  const loadingTask = getDocument({
    data: new Uint8Array(pdf),
    verbosity: 0,
  })
  const document = await loadingTask.promise

  try {
    const pages: string[] = []

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
      )
    }

    return pages.join(" ")
  } finally {
    await loadingTask.destroy()
  }
}

describe("buildCategoryReportPdf", () => {
  it("embeds readable Korean labels and formats won amounts", async () => {
    const pdf = await buildCategoryReportPdf({
      categories: [
        { category: "food_dining", total: 1_234_567 },
        { category: "transport", total: 45_000 },
        { category: "custom_category", total: 900 },
      ],
      monthly: [
        { month: "2026-07", total: 987_654 },
        { month: "2026-08", total: 1_280_000 },
      ],
      currentMonth: "2026-08",
      generatedAt: new Date("2026-08-10T11:30:00.000Z"),
    })

    const text = await extractText(pdf)

    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(text).toContain("Finsight 지출 리포트")
    expect(text).toContain("식비")
    expect(text).toContain("교통")
    expect(text).toContain("custom_category")
    expect(text).toContain("1,234,567원")
    expect(text).toContain("987,654원")
    expect(text).not.toContain("�")
  })

  it("returns a readable PDF when both summaries are empty", async () => {
    const pdf = await buildCategoryReportPdf({
      categories: [],
      monthly: [],
      currentMonth: "2026-08",
      generatedAt: new Date("2026-08-10T11:30:00.000Z"),
    })

    await expect(extractText(pdf)).resolves.toContain("데이터 없음")
    expect(Buffer.isBuffer(pdf)).toBe(true)
  })
})
