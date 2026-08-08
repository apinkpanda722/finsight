import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const routeMocks = vi.hoisted(() => ({
  after: vi.fn(),
  createAnthropicClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
  parseStatement: vi.fn(),
  requireUserId: vi.fn(),
  retryStatement: vi.fn(),
}))

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: routeMocks.after,
}))
vi.mock("@/lib/api/auth", () => ({
  requireUserId: routeMocks.requireUserId,
  UnauthorizedError: class UnauthorizedError extends Error {},
}))
vi.mock("@/lib/anthropic/client", () => ({
  createAnthropicClient: routeMocks.createAnthropicClient,
}))
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: routeMocks.createServiceRoleClient,
}))
vi.mock("@/services/statementParserService", () => ({
  parseStatement: routeMocks.parseStatement,
}))
vi.mock("@/services/statementUploadService", () => ({
  retryStatement: routeMocks.retryStatement,
  StatementUploadError: class StatementUploadError extends Error {
    constructor(
      public code: string,
      message: string,
      public httpStatus: number
    ) {
      super(message)
    }
  },
}))

import { POST } from "./route"

beforeEach(() => {
  vi.clearAllMocks()
  routeMocks.requireUserId.mockResolvedValue("user-id")
  routeMocks.createServiceRoleClient.mockReturnValue({ serviceRole: true })
  routeMocks.createAnthropicClient.mockReturnValue({ anthropic: true })
  routeMocks.retryStatement.mockResolvedValue(true)
})

describe("POST /api/statements/:id/retry", () => {
  it("uses a CAS retry transition and schedules the parser", async () => {
    const response = await POST(
      new NextRequest("https://finsight.test/api/statements/statement-id/retry", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "statement-id" }) }
    )

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({
      statementId: "statement-id",
      status: "pending",
    })
    expect(routeMocks.retryStatement).toHaveBeenCalledWith(
      "user-id",
      "statement-id",
      { supabase: { serviceRole: true } }
    )

    const scheduled = routeMocks.after.mock.calls[0]?.[0]
    await scheduled()
    expect(routeMocks.parseStatement).toHaveBeenCalledWith("statement-id", {
      supabase: { serviceRole: true },
      anthropic: { anthropic: true },
    })
  })
})
