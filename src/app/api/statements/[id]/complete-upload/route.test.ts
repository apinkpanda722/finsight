import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const routeMocks = vi.hoisted(() => ({
  completeStatementUpload: vi.fn(),
  createServiceRoleClient: vi.fn(),
  requireUserId: vi.fn(),
}))

vi.mock("@/lib/api/auth", () => ({
  requireUserId: routeMocks.requireUserId,
  UnauthorizedError: class UnauthorizedError extends Error {},
}))
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: routeMocks.createServiceRoleClient,
}))
vi.mock("@/services/statementUploadService", () => ({
  completeStatementUpload: routeMocks.completeStatementUpload,
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

import { maxDuration, POST } from "./route"

beforeEach(() => {
  vi.clearAllMocks()
  routeMocks.requireUserId.mockResolvedValue("user-id")
  routeMocks.createServiceRoleClient.mockReturnValue({ serviceRole: true })
  routeMocks.completeStatementUpload.mockResolvedValue({
    statementId: "statement-id",
    status: "pending",
  })
})

describe("POST /api/statements/:id/complete-upload", () => {
  it("is a validation-only route with a 60-second maximum duration", async () => {
    expect(maxDuration).toBe(60)

    const request = new NextRequest(
      "https://finsight.test/api/statements/statement-id/complete-upload",
      { method: "POST" }
    )
    const context = { params: Promise.resolve({ id: "statement-id" }) }

    const first = await POST(request, context)
    const second = await POST(request, context)

    expect(first.status).toBe(202)
    expect(second.status).toBe(202)
    await expect(second.json()).resolves.toEqual({
      statementId: "statement-id",
      status: "pending",
    })
    expect(routeMocks.completeStatementUpload).toHaveBeenCalledTimes(2)
  })
})
