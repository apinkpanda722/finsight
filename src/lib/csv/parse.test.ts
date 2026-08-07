import { describe, expect, it } from "vitest"

import { parseCsv } from "./parse"

describe("parseCsv", () => {
  it("separates the header from UTF-8 data rows", () => {
    expect(parseCsv("날짜,설명,금액\r\n2026-08-07,점심,12000\r\n")).toEqual({
      headers: ["날짜", "설명", "금액"],
      rows: [["2026-08-07", "점심", "12000"]],
    })
  })

  it("supports escaped quotes, commas, and newlines inside quoted fields", () => {
    const parsed = parseCsv(
      'date,description,amount\r\n2026-08-07,"Lunch, with ""team""\r\non level 2",12000'
    )

    expect(parsed.rows).toEqual([
      ["2026-08-07", 'Lunch, with "team"\r\non level 2', "12000"],
    ])
  })

  it("rejects NUL bytes", () => {
    expect(() => parseCsv("date,amount\n2026-08-07,12\0")).toThrow(/NUL/i)
  })

  it("rejects rows whose column counts differ from the header", () => {
    expect(() => parseCsv("date,amount\n2026-08-07,12,extra")).toThrow(
      /column/i
    )
  })

  it("reports all 2,001 data rows without silently truncating", () => {
    const rows = Array.from(
      { length: 2_001 },
      (_, index) => `2026-08-07,row-${index}`
    )
    const parsed = parseCsv(["date,description", ...rows].join("\n"))

    expect(parsed.rows).toHaveLength(2_001)
  })
})
