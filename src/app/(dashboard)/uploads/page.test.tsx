import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const pageMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  requireUserId: vi.fn(),
  routerReplace: vi.fn(),
  select: vi.fn(),
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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: pageMocks.routerReplace }),
}))

import UploadsPage from "./page"

beforeEach(() => {
  vi.clearAllMocks()
  pageMocks.requireUserId.mockResolvedValue("user-id")
  pageMocks.createClient.mockResolvedValue({ from: pageMocks.from })
  pageMocks.from.mockReturnValue({ select: pageMocks.select })
  pageMocks.select.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "statement-id",
            detected_label: "신한카드",
            file_name: "statement.csv",
            status: "completed",
            row_count: 12,
            error_message: null,
            processing_lease_expires_at: null,
            created_at: "2026-08-10T00:00:00.000Z",
            updated_at: "2026-08-10T00:01:00.000Z",
          },
        ],
        error: null,
      }),
    }),
  })
})

describe("UploadsPage", () => {
  it("loads user-owned statements with their detected labels and no account data", async () => {
    render(await UploadsPage())

    expect(screen.getByRole("heading", { name: "명세서 관리" })).toBeInTheDocument()
    expect(screen.getByText("statement.csv")).toBeInTheDocument()
    expect(screen.getByText("신한카드")).toHaveAttribute(
      "data-variant",
      "secondary"
    )
    expect(pageMocks.from).toHaveBeenCalledOnce()
    expect(pageMocks.from).toHaveBeenCalledWith("uploaded_statements")
    expect(pageMocks.from).not.toHaveBeenCalledWith("profiles")
    expect(pageMocks.from).not.toHaveBeenCalledWith("accounts")
    expect(pageMocks.select).toHaveBeenCalledWith(
      expect.stringContaining("detected_label")
    )
    expect(pageMocks.select).not.toHaveBeenCalledWith(
      expect.stringContaining("account_id")
    )
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
