import { afterEach, describe, expect, it } from "vitest"

import { getSiteUrl } from "./site-url"

describe("getSiteUrl", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("returns NEXT_PUBLIC_SITE_URL without a trailing slash when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://finsight.app/"

    expect(getSiteUrl()).toBe("https://finsight.app")
  })

  it("falls back to the Vercel deployment URL when no explicit domain is set", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    process.env.VERCEL_URL = "finsight-abc123.vercel.app"

    expect(getSiteUrl()).toBe("https://finsight-abc123.vercel.app")
  })

  it("falls back to localhost when neither is set", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.VERCEL_URL

    expect(getSiteUrl()).toBe("http://localhost:3000")
  })
})
