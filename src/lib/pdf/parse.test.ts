import { describe, expect, it } from "vitest"

import { isPdfBuffer, parsePdf } from "./parse"
import { buildTestPdf as buildPdf } from "@/test/pdf-fixture"

function widthOf(text: string, size = 10): number {
  // Helvetica's average advance width is close enough for gap-threshold tests.
  return text.length * size * 0.5
}

describe("isPdfBuffer", () => {
  it("recognizes the %PDF- magic header", async () => {
    const buf = await buildPdf([[{ text: "Date", x: 50 }, { text: "Amount", x: 200 }]])
    expect(isPdfBuffer(buf)).toBe(true)
  })

  it("rejects buffers without the PDF signature", () => {
    expect(isPdfBuffer(Buffer.from("date,amount\n2026-01-01,100"))).toBe(false)
  })
})

describe("parsePdf", () => {
  it("extracts a header row and data rows from a simple table", async () => {
    const buf = await buildPdf([
      [{ text: "Date", x: 50 }, { text: "Description", x: 140 }, { text: "Amount", x: 400 }],
      [{ text: "2026-01-05", x: 50 }, { text: "Coffee", x: 140 }, { text: "4.50", x: 400 }],
      [{ text: "2026-01-06", x: 50 }, { text: "Groceries", x: 140 }, { text: "12.30", x: 400 }],
    ])

    await expect(parsePdf(buf)).resolves.toEqual({
      headers: ["Date", "Description", "Amount"],
      rows: [
        ["2026-01-05", "Coffee", "4.50"],
        ["2026-01-06", "Groceries", "12.30"],
      ],
    })
  })

  it("skips a title line that appears before the actual header row", async () => {
    const buf = await buildPdf([
      [{ text: "Monthly Statement", x: 50 }],
      [{ text: "Date", x: 50 }, { text: "Amount", x: 400 }],
      [{ text: "2026-01-05", x: 50 }, { text: "4.50", x: 400 }],
    ])

    await expect(parsePdf(buf)).resolves.toEqual({
      headers: ["Date", "Amount"],
      rows: [["2026-01-05", "4.50"]],
    })
  })

  it("fills a column with an empty string when a row has no value in it", async () => {
    const buf = await buildPdf([
      [{ text: "Date", x: 50 }, { text: "Debit", x: 400 }, { text: "Credit", x: 490 }],
      [{ text: "2026-01-05", x: 50 }, { text: "10.00", x: 400 }],
      [{ text: "2026-01-06", x: 50 }, { text: "20.00", x: 490 }],
    ])

    await expect(parsePdf(buf)).resolves.toEqual({
      headers: ["Date", "Debit", "Credit"],
      rows: [
        ["2026-01-05", "10.00", ""],
        ["2026-01-06", "", "20.00"],
      ],
    })
  })

  it("merges text fragments separated by a small gap into a single cell", async () => {
    const firstWordWidth = widthOf("Coffee")
    const buf = await buildPdf([
      [{ text: "Date", x: 50 }, { text: "Description", x: 140 }],
      [
        { text: "2026-01-05", x: 50 },
        { text: "Coffee", x: 140 },
        { text: "Shop", x: 140 + firstWordWidth + 2 },
      ],
    ])

    await expect(parsePdf(buf)).resolves.toEqual({
      headers: ["Date", "Description"],
      rows: [["2026-01-05", "Coffee Shop"]],
    })
  })

  it("returns an empty rows array when the PDF has only a header row", async () => {
    const buf = await buildPdf([[{ text: "Date", x: 50 }, { text: "Amount", x: 400 }]])

    await expect(parsePdf(buf)).resolves.toEqual({
      headers: ["Date", "Amount"],
      rows: [],
    })
  })

  it("rejects a PDF with no multi-column header row", async () => {
    const buf = await buildPdf([[{ text: "Just a title", x: 50 }]])

    await expect(parsePdf(buf)).rejects.toThrow(/header/i)
  })

  it("rejects a buffer that is not a valid PDF", async () => {
    await expect(parsePdf(Buffer.from("not a pdf"))).rejects.toThrow()
  })
})
