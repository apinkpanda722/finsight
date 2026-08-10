import { describe, expect, it } from "vitest"

import Icon, { contentType, size } from "./icon"

describe("Icon", () => {
  it("renders a PNG at the configured favicon size", () => {
    const response = Icon()

    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get("content-type")).toBe(contentType)
    expect(size).toEqual({ width: 32, height: 32 })
  })
})
