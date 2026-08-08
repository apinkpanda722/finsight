import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const pageMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  requireUserId: vi.fn(),
}))

vi.mock("@/lib/api/auth", () => ({
  requireUserId: pageMocks.requireUserId,
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: pageMocks.createClient,
}))
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}))

import UploadsPage from "./page"

beforeEach(() => {
  vi.clearAllMocks()
  pageMocks.requireUserId.mockResolvedValue("user-id")
  pageMocks.createClient.mockResolvedValue({ from: pageMocks.from })
  pageMocks.from.mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { plan: "free" },
              error: null,
            }),
          }),
        }),
      }
    }
    if (table === "accounts") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ id: "account-1", label: "신한카드" }],
              error: null,
            }),
          }),
        }),
      }
    }
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "statement-1",
                account_id: "account-1",
                file_name: "statement.csv",
                status: "completed",
                row_count: 12,
                error_message: null,
                processing_lease_expires_at: null,
                created_at: "2026-08-07T10:00:00.000Z",
                updated_at: "2026-08-07T10:00:00.000Z",
              },
            ],
            error: null,
          }),
        }),
      }),
    }
  })
})

describe("UploadsPage", () => {
  it("loads the authenticated user's plan, accounts, and statement list", async () => {
    render(await UploadsPage())

    expect(screen.getByRole("heading", { name: "명세서 관리" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "신한카드" })).toBeInTheDocument()
    expect(screen.getByText("statement.csv")).toBeInTheDocument()
    expect(pageMocks.from).toHaveBeenCalledWith("profiles")
    expect(pageMocks.from).toHaveBeenCalledWith("accounts")
    expect(pageMocks.from).toHaveBeenCalledWith("uploaded_statements")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens the upload dialog on arrival when ?upload=1 is present", async () => {
    render(
      await UploadsPage({ searchParams: Promise.resolve({ upload: "1" }) })
    )

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("명세서 업로드")).toBeInTheDocument()
  })
})
