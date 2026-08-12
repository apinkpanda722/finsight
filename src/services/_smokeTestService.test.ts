import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: "test-user" }, error: null }),
        }),
      }),
    }),
  })),
}))

import { smokeTestFetchProfile } from "./_smokeTestService"

describe("smokeTestFetchProfile", () => {
  it("returns profile data for the given user id", async () => {
    const result = await smokeTestFetchProfile("test-user")

    expect(result).toEqual({ id: "test-user" })
  })
})
