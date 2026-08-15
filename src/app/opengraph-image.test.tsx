import { describe, expect, it } from "vitest"

import OpengraphImage, { contentType, size } from "./opengraph-image"

describe("OpengraphImage", () => {
  it("renders a PNG at the standard Open Graph size", () => {
    const response = OpengraphImage()

    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get("content-type")).toBe(contentType)
    expect(size).toEqual({ width: 1200, height: 630 })
  })
})
