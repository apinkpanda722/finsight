import { describe, expect, it } from "vitest"

import { apiError } from "./response"

describe("apiError", () => {
  it("returns a stable error code and safe message", async () => {
    const response = apiError(
      "validation_error",
      "CSV 구조를 읽을 수 없습니다.",
      422
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: "validation_error",
      message: "CSV 구조를 읽을 수 없습니다.",
    })
  })
})
