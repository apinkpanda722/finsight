import { describe, expect, it } from "vitest"

import { toWonLabel } from "./nitCurrencyFormat"

describe("toWonLabel (review-code 게이트 검증용 픽스처, #106)", () => {
  it("금액을 천 단위 콤마와 원 단위로 포맷한다", () => {
    expect(toWonLabel(1234567)).toBe("1,234,567원")
  })
})
