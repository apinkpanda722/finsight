import iconv from "iconv-lite"
import { describe, expect, it } from "vitest"

import { decodeCsvBuffer } from "./decode"

describe("decodeCsvBuffer", () => {
  it("decodes valid UTF-8", () => {
    const result = decodeCsvBuffer(Buffer.from("날짜,금액\n2026-08-07,12000", "utf8"))

    expect(result).toEqual({
      text: "날짜,금액\n2026-08-07,12000",
      encoding: "utf-8",
    })
  })

  it("removes a UTF-8 BOM", () => {
    const result = decodeCsvBuffer(
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from("날짜,금액", "utf8"),
      ])
    )

    expect(result).toEqual({ text: "날짜,금액", encoding: "utf-8" })
  })

  it("falls back to CP949", () => {
    const result = decodeCsvBuffer(iconv.encode("일자,적요\n2026-08-07,점심", "cp949"))

    expect(result).toEqual({
      text: "일자,적요\n2026-08-07,점심",
      encoding: "cp949",
    })
  })

  it("rejects bytes that are neither valid UTF-8 nor valid CP949", () => {
    expect(() => decodeCsvBuffer(Buffer.from([0x81, 0x20, 0xff]))).toThrow(
      /encoding/i
    )
  })
})
