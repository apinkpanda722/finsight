import { describe, expect, it } from "vitest"

import { isOverFreeQuota } from "./minorQuotaCheck"

describe("isOverFreeQuota (review-code 게이트 검증용 픽스처, #106)", () => {
  it("한도를 초과하면 true를 반환한다", () => {
    expect(isOverFreeQuota(5, 3)).toBe(true)
  })

  it("한도 미만이면 false를 반환한다", () => {
    expect(isOverFreeQuota(1, 3)).toBe(false)
  })
})
