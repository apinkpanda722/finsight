import { describe, expect, it, vi } from "vitest"

import { isAuthenticated } from "./criticalAuthCheck"

describe("isAuthenticated (review-code 게이트 검증용 픽스처, #106)", () => {
  it("세션이 있으면 true를 반환한다", async () => {
    const supabase = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValue({ data: { session: { user: { id: "user-1" } } } }),
      },
    }

    await expect(isAuthenticated(supabase)).resolves.toBe(true)
  })

  it("세션이 없으면 false를 반환한다", async () => {
    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
    }

    await expect(isAuthenticated(supabase)).resolves.toBe(false)
  })
})
