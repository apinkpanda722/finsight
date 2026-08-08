import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  ANTHROPIC_API_KEY: "anthropic-key",
  POLAR_ACCESS_TOKEN: "polar-access-token",
  POLAR_WEBHOOK_SECRET: "polar-webhook-secret",
  POLAR_PRO_PRODUCT_ID: "polar-product-id",
  POLAR_SERVER: "sandbox",
  SUCCESS_URL: "https://finsight.example.com/billing/success",
} as const

async function importEnv() {
  vi.resetModules()
  return import("./env")
}

function stubValidEnvironment() {
  for (const [key, value] of Object.entries(validEnvironment)) {
    vi.stubEnv(key, value)
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("env", () => {
  it("fails with a clear error when a required variable is empty", async () => {
    stubValidEnvironment()
    vi.stubEnv("ANTHROPIC_API_KEY", "")

    await expect(importEnv()).rejects.toThrow(/ANTHROPIC_API_KEY/)
  })

  it("returns a typed object when every required variable is valid", async () => {
    stubValidEnvironment()

    const { env } = await importEnv()

    expect(env).toEqual(validEnvironment)
    expectTypeOf(env.POLAR_SERVER).toEqualTypeOf<"sandbox" | "production">()
    expectTypeOf(env.SUCCESS_URL).toBeString()
  })
})
