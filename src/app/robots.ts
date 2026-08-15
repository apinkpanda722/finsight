import type { MetadataRoute } from "next"

import { getSiteUrl } from "@/lib/site-url"

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/uploads",
        "/settings",
        "/login",
        "/forgot-password",
        "/reset-password",
        "/auth",
        "/api",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
