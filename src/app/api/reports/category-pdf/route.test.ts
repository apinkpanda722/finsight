import { beforeEach, describe, expect, it, vi } from "vitest"

const routeMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  generateCategoryReportPdf: vi.fn(),
  requireUserId: vi.fn(),
}))

vi.mock("@/lib/api/auth", () => ({
  requireUserId: routeMocks.requireUserId,
  UnauthorizedError: class UnauthorizedError extends Error {},
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: routeMocks.createClient,
}))
vi.mock("@/services/reportService", () => ({
  generateCategoryReportPdf: routeMocks.generateCategoryReportPdf,
  ReportAccessError: class ReportAccessError extends Error {
    readonly code = "forbidden"
  },
}))

import { UnauthorizedError } from "@/lib/api/auth"
import { ReportAccessError } from "@/services/reportService"

import { GET } from "./route"

beforeEach(() => {
  vi.clearAllMocks()
  routeMocks.requireUserId.mockResolvedValue("user-id")
  routeMocks.createClient.mockResolvedValue({ rlsScoped: true })
  routeMocks.generateCategoryReportPdf.mockResolvedValue(
    Buffer.from("%PDF-report")
  )
})

describe("GET /api/reports/category-pdf", () => {
  it("returns 401 when the user is not authenticated", async () => {
    routeMocks.requireUserId.mockRejectedValue(new UnauthorizedError())

    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized",
      message: "로그인이 필요합니다.",
    })
    expect(routeMocks.createClient).not.toHaveBeenCalled()
  })

  it("returns 403 when the authenticated user is on the Free plan", async () => {
    routeMocks.generateCategoryReportPdf.mockRejectedValue(
      new ReportAccessError()
    )

    const response = await GET()

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: "forbidden",
      message: "Pro 사용자만 이용할 수 있는 기능입니다.",
    })
  })

  it("returns a downloadable PDF for Pro users", async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="finsight-report-\d{4}-\d{2}\.pdf"$/
    )
    expect(routeMocks.generateCategoryReportPdf).toHaveBeenCalledWith(
      "user-id",
      { supabase: { rlsScoped: true } }
    )
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
      "%PDF-report"
    )
  })
})
