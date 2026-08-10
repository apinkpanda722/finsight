import { PDFDocument, StandardFonts } from "pdf-lib"

export async function buildTestPdf(
  lines: Array<Array<{ text: string; x: number }>>,
  options: { y?: number; lineHeight?: number; size?: number } = {}
): Promise<Buffer> {
  const size = options.size ?? 10
  const lineHeight = options.lineHeight ?? 18
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const font = await doc.embedFont(StandardFonts.Helvetica)

  let y = options.y ?? 800
  for (const line of lines) {
    for (const item of line) {
      page.drawText(item.text, { x: item.x, y, size, font })
    }
    y -= lineHeight
  }

  return Buffer.from(await doc.save())
}
