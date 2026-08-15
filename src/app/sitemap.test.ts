import { afterEach, describe, expect, it } from "vitest"

import sitemap from "./sitemap"

describe("sitemap", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it("lists the public marketing homepage at the configured site URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://finsight.app"

    const entries = sitemap()

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      url: "https://finsight.app",
      changeFrequency: "weekly",
      priority: 1,
    })
  })
})
