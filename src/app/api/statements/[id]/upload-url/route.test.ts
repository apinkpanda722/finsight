import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const routeMocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  reissueUploadUrl: vi.fn(),
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
  reissueUploadUrl: routeMocks.reissueUploadUrl,
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
  routeMocks.reissueUploadUrl.mockResolvedValue({ uploadToken: "new-token" })
})

describe("POST /api/statements/:id/upload-url", () => {
  it("returns a replacement token for the same statement", async () => {
    const response = await POST(
      new NextRequest("https://finsight.test/api/statements/statement-id/upload-url", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "statement-id" }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ uploadToken: "new-token" })
    expect(routeMocks.reissueUploadUrl).toHaveBeenCalledWith(
      "user-id",
      "statement-id",
      { supabase: { serviceRole: true } }
    )
  })

  it.each([
    ["not_found", 404],
    ["conflict", 409],
  ])("returns %s as HTTP %s", async (code, status) => {
    routeMocks.reissueUploadUrl.mockRejectedValueOnce(
      new StatementUploadError(code as never, "고정된 안내", status)
    )

    const response = await POST(
      new NextRequest("https://finsight.test/api/statements/statement-id/upload-url", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "statement-id" }) }
    )

    expect(response.status).toBe(status)
    expect((await response.json()).error).toBe(code)
  })
})
