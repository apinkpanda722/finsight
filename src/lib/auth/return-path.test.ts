import { describe, expect, it } from "vitest"

import { isSafeReturnPath } from "./return-path"

describe("isSafeReturnPath", () => {
  it.each(["/", "/dashboard", "/settings/billing?tab=plan"])(
    "accepts the local path %s",
    (path) => {
      expect(isSafeReturnPath(path)).toBe(true)
    }
  )

  it.each([
    "",
    "dashboard",
    "//evil.com",
    "https://evil.com",
    "/https://evil.com",
    "/\\evil.com",
  ])("rejects the unsafe path %s", (path) => {
    expect(isSafeReturnPath(path)).toBe(false)
  })
})
