import {
  getDocument,
  type PDFPageProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs"

type TextContentItem = Awaited<
  ReturnType<PDFPageProxy["getTextContent"]>
>["items"][number]
type TextItem = Extract<TextContentItem, { str: string }>

export type ParsedPdf = {
  headers: string[]
  rows: string[][]
}

const PDF_MAGIC = Buffer.from("%PDF-")

// A gap wider than this many PDF points separates two table cells rather
// than two words within the same cell.
const SEGMENT_GAP_THRESHOLD = 12
// Text items within this many points of vertical offset belong to the same line.
const LINE_Y_TOLERANCE = 2

export function isPdfBuffer(buf: Buffer): boolean {
  return buf.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)
}

type PositionedItem = { text: string; x: number; width: number }
type Line = { y: number; items: PositionedItem[] }
type Segment = { text: string; xStart: number; end: number }

function isTextItem(item: TextContentItem): item is TextItem {
  return "str" in item
}

function groupIntoLines(items: TextItem[]): Line[] {
  const lines: Line[] = []

  for (const item of items) {
    if (item.str.trim() === "" && item.width === 0) continue

    const x = item.transform[4]
    const y = item.transform[5]
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= LINE_Y_TOLERANCE)
    if (!line) {
      line = { y, items: [] }
      lines.push(line)
    }
    line.items.push({ text: item.str, x, width: item.width })
  }

  lines.sort((a, b) => b.y - a.y)
  for (const line of lines) line.items.sort((a, b) => a.x - b.x)
  return lines
}

function lineToSegments(line: Line): Segment[] {
  const segments: Segment[] = []
  let current: Segment | null = null

  for (const item of line.items) {
    if (item.text.trim() === "") {
      if (current && item.width > SEGMENT_GAP_THRESHOLD) {
        segments.push(current)
        current = null
      }
      continue
    }

    if (current && item.x - current.end > SEGMENT_GAP_THRESHOLD) {
      segments.push(current)
      current = null
    }

    if (!current) {
      current = { text: item.text, xStart: item.x, end: item.x + item.width }
    } else {
      current.text += item.text
      current.end = item.x + item.width
    }
  }

  if (current) segments.push(current)
  return segments
}

function assignToColumns(segments: Segment[], columnXStarts: number[]): string[] {
  const row = columnXStarts.map(() => "")

  for (const segment of segments) {
    let columnIndex = 0
    for (let index = 0; index < columnXStarts.length; index += 1) {
      if (columnXStarts[index] <= segment.xStart + 1) columnIndex = index
    }
    row[columnIndex] = row[columnIndex]
      ? `${row[columnIndex]} ${segment.text}`
      : segment.text
  }

  return row
}

export async function parsePdf(buf: Buffer): Promise<ParsedPdf> {
  const pdf = await getDocument({
    data: new Uint8Array(buf),
    verbosity: 0,
  }).promise

  const lines: Line[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    lines.push(...groupIntoLines(content.items.filter(isTextItem)))
  }

  const lineSegments = lines
    .map(lineToSegments)
    .filter((segments) => segments.length > 0)

  const headerLineIndex = lineSegments.findIndex((segments) => segments.length >= 2)
  if (headerLineIndex === -1) {
    throw new Error("PDF must contain a header row")
  }

  const headerSegments = lineSegments[headerLineIndex]
  const headers = headerSegments.map((segment) => segment.text)
  const columnXStarts = headerSegments.map((segment) => segment.xStart)
  const rows = lineSegments
    .slice(headerLineIndex + 1)
    .map((segments) => assignToColumns(segments, columnXStarts))

  return { headers, rows }
}
