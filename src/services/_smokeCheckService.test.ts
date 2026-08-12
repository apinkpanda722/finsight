import { describe, expect, it, vi } from "vitest"

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      messages = {
        create: vi.fn().mockResolvedValue({ id: "msg_test" }),
      }
    },
  }
})

import { smokeCheckSummary } from "./_smokeCheckService"

describe("smokeCheckSummary", () => {
  it("returns the Anthropic response", async () => {
    const result = await smokeCheckSummary("hello")
    expect(result).toEqual({ id: "msg_test" })
  })
})
