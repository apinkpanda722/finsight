#!/usr/bin/env node
// PDF 업로드 기능을 수동으로 테스트하기 위한 샘플 카드 명세서를 생성해
// 프로젝트 루트에 sample-statement.pdf로 저장한다.
//
// 15개 카테고리(TRANSACTION_CATEGORIES)를 모두 최소 한 번씩 포함하고,
// 최근 3개월(Free 잠금 경계) 안팎에 걸친 거래일자와 출금/입금 분리 컬럼을
// 넣어서 컬럼 매핑, 카테고리 분류, Free 잠금 UI를 한 파일로 확인할 수 있게 했다.
import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import fontkit from "@pdf-lib/fontkit"
import { PDFDocument } from "pdf-lib"

const KOREAN_FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/AppleGothic.ttf", // macOS
  "/usr/share/fonts/truetype/nanum/NanumGothic.ttf", // Linux (fonts-nanum)
  "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", // Linux (fonts-noto-cjk)
  "C:\\Windows\\Fonts\\malgun.ttf", // Windows
]

const COLUMNS = [
  { header: "거래일자", x: 50 },
  { header: "적요", x: 140 },
  { header: "출금액", x: 380 },
  { header: "입금액", x: 480 },
]

// [date, description, debitAmount, creditAmount] — 카테고리는 Claude가 분류하므로
// 여기서는 명시하지 않고, 실제 카드 명세서에 나올 법한 가맹점명만 넣는다.
const TRANSACTIONS = [
  ["2026.08.05", "스타벅스 강남점", "4,500", ""],
  ["2026.08.04", "이마트 성수점", "68,200", ""],
  ["2026.08.03", "카카오T 택시", "12,300", ""],
  ["2026.08.02", "무신사", "89,000", ""],
  ["2026.08.01", "CGV 강남", "15,000", ""],
  ["2026.07.28", "한국전력공사", "54,320", ""],
  ["2026.07.25", "행복오피스텔 관리비", "210,000", ""],
  ["2026.07.20", "강남세브란스병원", "32,000", ""],
  ["2026.07.15", "해커스어학원", "180,000", ""],
  ["2026.07.10", "대한항공", "340,000", ""],
  ["2026.07.05", "넷플릭스", "17,000", ""],
  ["2026.07.01", "(주)에이비씨 급여", "", "3,200,000"],
  ["2026.06.28", "계좌이체 김민수", "100,000", ""],
  ["2026.06.25", "카드 연회비", "15,000", ""],
  ["2026.06.20", "스타벅스 판교점", "5,600", ""],
  ["2026.06.10", "배달의민족", "23,400", ""],
  ["2026.05.10", "이마트 트레이더스", "152,300", ""],
  ["2026.05.05", "지하철 정기권", "55,000", ""],
  ["2026.04.28", "강남세브란스병원", "45,000", ""],
  ["2026.04.15", "(주)에이비씨 급여", "", "3,200,000"],
  ["2026.04.01", "행복오피스텔 월세", "850,000", ""],
  ["2026.03.20", "배달의민족", "23,400", ""],
  ["2026.03.05", "넷플릭스", "17,000", ""],
  ["2026.03.01", "올리브영", "31,500", ""],
]

async function loadKoreanFont(doc) {
  doc.registerFontkit(fontkit)
  const fontPath = KOREAN_FONT_CANDIDATES.find((path) => existsSync(path))
  if (!fontPath) {
    throw new Error(
      "한글 지원 TTF 폰트를 찾을 수 없습니다. KOREAN_FONT_CANDIDATES에 사용 중인 OS의 폰트 경로를 추가하세요."
    )
  }
  return doc.embedFont(await readFile(fontPath), { subset: true })
}

async function main() {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const font = await loadKoreanFont(doc)

  let y = 800
  page.drawText("2026년 8월 신한카드 이용대금 명세서", { x: 50, y, size: 14, font })
  y -= 22
  page.drawText("카드번호 1234-56**-****-7890", { x: 50, y, size: 10, font })
  y -= 18

  for (const column of COLUMNS) {
    page.drawText(column.header, { x: column.x, y, size: 11, font })
  }
  y -= 20

  for (const [date, description, debit, credit] of TRANSACTIONS) {
    page.drawText(date, { x: COLUMNS[0].x, y, size: 10, font })
    page.drawText(description, { x: COLUMNS[1].x, y, size: 10, font })
    if (debit) page.drawText(debit, { x: COLUMNS[2].x, y, size: 10, font })
    if (credit) page.drawText(credit, { x: COLUMNS[3].x, y, size: 10, font })
    y -= 18
  }

  const outputPath = fileURLToPath(new URL("../sample-statement.pdf", import.meta.url))
  await writeFile(outputPath, await doc.save())
  console.log(`Wrote ${TRANSACTIONS.length} transactions to ${outputPath}`)
}

await main()
