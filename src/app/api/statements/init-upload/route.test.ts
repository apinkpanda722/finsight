import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const routeMocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  initStatementUpload: vi.fn(),
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
  initStatementUpload: routeMocks.initStatementUpload,
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
  routeMocks.initStatementUpload.mockResolvedValue({
    statementId: "statement-id",
    storagePath: "user-id/statement-id",
    uploadToken: "token",
    status: "uploading",
  })
})

describe("POST /api/statements/init-upload", () => {
  it("validates metadata and delegates quota reservation to the service", async () => {
    const request = new NextRequest("https://finsight.test/api/statements/init-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileName: "statement.csv",
        declaredSizeBytes: 1024,
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(201)
    expect(routeMocks.initStatementUpload).toHaveBeenCalledWith(
      "user-id",
      {
        fileName: "statement.csv",
        declaredSizeBytes: 1024,
      },
      { supabase: { serviceRole: true } }
    )
  })

  it("rejects incomplete file metadata", async () => {
    const request = new NextRequest("https://finsight.test/api/statements/init-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "statement.csv" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(routeMocks.initStatementUpload).not.toHaveBeenCalled()
  })
})
