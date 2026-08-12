import { describe, expect, it } from "vitest"

import { toDiscountLabel } from "./nitDiscountLabel"

describe("toDiscountLabel (review-code 게이트 검증용 픽스처 v2, #112)", () => {
  it("할인율을 퍼센트 라벨로 포맷한다", () => {
    expect(toDiscountLabel(15)).toBe("15% 할인")
  })
})
