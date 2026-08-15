import { afterEach, describe, expect, it } from "vitest"

import robots from "./robots"

describe("robots", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it("allows crawling the public marketing site while blocking authenticated areas", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://finsight.app"

    const result = robots()

    expect(result.rules).toMatchObject({
      userAgent: "*",
      allow: "/",
    })
    const disallow = Array.isArray(
      (result.rules as { disallow?: string[] | string }).disallow
    )
      ? ((result.rules as { disallow?: string[] }).disallow ?? [])
      : []
    expect(disallow).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/uploads",
        "/settings",
        "/login",
        "/forgot-password",
        "/reset-password",
        "/auth",
        "/api",
      ])
    )
    expect(result.sitemap).toBe("https://finsight.app/sitemap.xml")
  })
})
