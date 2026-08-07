import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const routeMocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  deleteOwnedStatement: vi.fn(),
  getStatementStatus: vi.fn(),
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
  deleteOwnedStatement: routeMocks.deleteOwnedStatement,
  getStatementStatus: routeMocks.getStatementStatus,
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

import { DELETE, GET } from "./route"

beforeEach(() => {
  vi.clearAllMocks()
  routeMocks.requireUserId.mockResolvedValue("user-id")
  routeMocks.createServiceRoleClient.mockReturnValue({ serviceRole: true })
  routeMocks.getStatementStatus.mockResolvedValue({
    statementId: "statement-id",
    accountId: "account-id",
    fileName: "statement.csv",
    status: "pending",
    rowCount: 10,
    errorMessage: null,
    createdAt: "2026-08-07T10:00:00.000Z",
    updatedAt: "2026-08-07T10:00:00.000Z",
    retryable: false,
  })
  routeMocks.deleteOwnedStatement.mockResolvedValue(true)
})

describe("/api/statements/:id", () => {
  it("returns the owned statement status", async () => {
    const response = await GET(
      new NextRequest("https://finsight.test/api/statements/statement-id"),
      { params: Promise.resolve({ id: "statement-id" }) }
    )

    expect(response.status).toBe(200)
    expect((await response.json()).retryable).toBe(false)
  })

  it("deletes the owned statement", async () => {
    const response = await DELETE(
      new NextRequest("https://finsight.test/api/statements/statement-id", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "statement-id" }) }
    )

    expect(response.status).toBe(204)
    expect(routeMocks.deleteOwnedStatement).toHaveBeenCalledWith(
      "user-id",
      "statement-id",
      { supabase: { serviceRole: true } }
    )
  })
})
