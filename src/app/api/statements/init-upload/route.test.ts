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

import { StatementUploadError } from "@/services/statementUploadService"
import { POST } from "./route"

beforeEach(() => {
  vi.clearAllMocks()
  routeMocks.requireUserId.mockResolvedValue("user-id")
  routeMocks.createServiceRoleClient.mockReturnValue({ serviceRole: true })
  routeMocks.initStatementUpload.mockResolvedValue({
    statementId: "statement-id",
    accountId: "02a4f23e-6ce5-4743-8858-9822cda92031",
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
        accountId: "02a4f23e-6ce5-4743-8858-9822cda92031",
        fileName: "statement.csv",
        declaredSizeBytes: 1024,
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(201)
    expect(routeMocks.initStatementUpload).toHaveBeenCalledWith(
      "user-id",
      {
        accountId: "02a4f23e-6ce5-4743-8858-9822cda92031",
        fileName: "statement.csv",
        declaredSizeBytes: 1024,
      },
      { supabase: { serviceRole: true } }
    )
  })

  it("rejects metadata that selects neither an existing nor a new account", async () => {
    const request = new NextRequest("https://finsight.test/api/statements/init-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "statement.csv", declaredSizeBytes: 100 }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(routeMocks.initStatementUpload).not.toHaveBeenCalled()
  })

  it("returns the upgrade status selected by the service", async () => {
    routeMocks.initStatementUpload.mockRejectedValueOnce(
      new StatementUploadError(
        "upgrade_required" as never,
        "계좌를 추가하려면 Pro 요금제가 필요합니다.",
        403
      )
    )
    const request = new NextRequest("https://finsight.test/api/statements/init-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        newAccountLabel: "새 계좌",
        fileName: "statement.csv",
        declaredSizeBytes: 100,
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(403)
    expect((await response.json()).error).toBe("upgrade_required")
  })
})
