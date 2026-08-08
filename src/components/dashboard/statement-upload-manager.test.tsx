import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const uiMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  uploadToSignedUrl: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: uiMocks.createClient,
}))

import {
  StatementUploadManager,
  type UploadStatement,
} from "./statement-upload-manager"

const accounts = [
  { id: "account-1", label: "신한카드" },
  { id: "account-2", label: "국민은행" },
]

const completedStatement: UploadStatement = {
  statementId: "statement-1",
  accountId: "account-1",
  fileName: "신한카드_2026-08.csv",
  status: "completed",
  rowCount: 142,
  errorMessage: null,
  createdAt: "2026-08-07T10:00:00.000Z",
  updatedAt: "2026-08-07T10:00:00.000Z",
  retryable: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  uiMocks.createClient.mockReturnValue({
    storage: {
      from: vi.fn().mockReturnValue({
        uploadToSignedUrl: uiMocks.uploadToSignedUrl,
      }),
    },
  })
  uiMocks.uploadToSignedUrl.mockResolvedValue({ data: { path: "path" }, error: null })
  vi.stubGlobal("fetch", vi.fn())
})

describe("StatementUploadManager", () => {
  it("shows account chips and routes locked Free accounts to the upgrade dialog", async () => {
    const user = userEvent.setup()
    render(
      <StatementUploadManager
        plan="free"
        initialAccounts={accounts}
        initialStatements={[]}
      />
    )

    expect(screen.getByRole("button", { name: "신한카드" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await user.click(screen.getByRole("button", { name: "국민은행 🔒" }))

    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText("Pro 요금제가 필요합니다")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Pro로 업그레이드" })).toBeInTheDocument()
  })

  it("uploads directly to Storage and reissues a token after a network failure", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statementId: "statement-2",
            accountId: "account-1",
            storagePath: "user-id/statement-2",
            uploadToken: "first-token",
            status: "uploading",
          }),
          { status: 201, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ uploadToken: "replacement-token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ statementId: "statement-2", status: "pending" }),
          { status: 202, headers: { "content-type": "application/json" } }
        )
      )
    uiMocks.uploadToSignedUrl
      .mockResolvedValueOnce({ data: null, error: { message: "network" } })
      .mockResolvedValueOnce({ data: { path: "user-id/statement-2" }, error: null })

    render(
      <StatementUploadManager
        plan="free"
        initialAccounts={[accounts[0]]}
        initialStatements={[]}
      />
    )

    await user.click(screen.getByRole("button", { name: "CSV 업로드" }))
    const file = new File(["date,amount\n2026-08-07,12000"], "statement.csv", {
      type: "text/csv",
    })
    await user.upload(screen.getByLabelText("CSV 파일"), file)
    await user.click(
      screen.getByRole("checkbox", {
        name: /Supabase Storage와 Anthropic/,
      })
    )
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    await screen.findByText("처리 대기 중")
    expect(uiMocks.uploadToSignedUrl).toHaveBeenNthCalledWith(
      1,
      "user-id/statement-2",
      "first-token",
      file,
      expect.objectContaining({ contentType: "text/csv" })
    )
    expect(uiMocks.uploadToSignedUrl).toHaveBeenNthCalledWith(
      2,
      "user-id/statement-2",
      "replacement-token",
      file,
      expect.objectContaining({ contentType: "text/csv" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/statements/statement-2/upload-url",
      expect.objectContaining({ method: "POST" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/statements/statement-2/complete-upload",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("shows rate-limit guidance from init-upload", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "rate_limited",
          message: "24시간 업로드 제한에 도달했습니다.",
        }),
        { status: 429, headers: { "content-type": "application/json" } }
      )
    )

    render(
      <StatementUploadManager
        plan="free"
        initialAccounts={[accounts[0]]}
        initialStatements={[]}
      />
    )

    await user.click(screen.getByRole("button", { name: "CSV 업로드" }))
    await user.upload(
      screen.getByLabelText("CSV 파일"),
      new File(["date,amount\n2026-08-07,1"], "statement.csv", {
        type: "text/csv",
      })
    )
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "24시간 업로드 제한에 도달했습니다."
    )
    expect(uiMocks.uploadToSignedUrl).not.toHaveBeenCalled()
  })

  it("opens the upgrade dialog for an upgrade_required API response", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "upgrade_required",
          message: "계좌를 추가하려면 Pro 요금제가 필요합니다.",
        }),
        { status: 403, headers: { "content-type": "application/json" } }
      )
    )

    render(
      <StatementUploadManager
        plan="free"
        initialAccounts={[]}
        initialStatements={[]}
      />
    )

    await user.click(screen.getByRole("button", { name: "신규 계좌" }))
    await user.type(screen.getByLabelText("신규 계좌 이름"), "신한카드")
    await user.click(screen.getByRole("button", { name: "CSV 업로드" }))
    await user.upload(
      screen.getByLabelText("CSV 파일"),
      new File(["date,amount\n2026-08-07,1"], "statement.csv", {
        type: "text/csv",
      })
    )
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    expect(
      await screen.findByText("Pro 요금제가 필요합니다")
    ).toBeInTheDocument()
  })

  it("uses inline confirmation and removes a deleted statement row", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))
    render(
      <StatementUploadManager
        plan="pro"
        initialAccounts={accounts}
        initialStatements={[completedStatement]}
      />
    )

    const row = screen.getByTestId("statement-statement-1")
    await user.click(within(row).getByRole("button", { name: "삭제" }))
    expect(within(row).getByText("삭제할까요?")).toBeInTheDocument()
    await user.click(within(row).getByRole("button", { name: "삭제 확인" }))

    await waitFor(() => {
      expect(screen.queryByText("신한카드_2026-08.csv")).not.toBeInTheDocument()
    })
    expect(fetch).toHaveBeenCalledWith("/api/statements/statement-1", {
      method: "DELETE",
    })
  })

  it("shows a retry action and returns a failed statement to pending", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ statementId: "statement-1", status: "pending" }),
        { status: 202, headers: { "content-type": "application/json" } }
      )
    )
    render(
      <StatementUploadManager
        plan="pro"
        initialAccounts={accounts}
        initialStatements={[
          {
            ...completedStatement,
            status: "failed",
            errorMessage: "분류를 완료할 수 없습니다.",
            retryable: true,
          },
        ]}
      />
    )

    const row = screen.getByTestId("statement-statement-1")
    await user.click(within(row).getByRole("button", { name: "재시도" }))

    await waitFor(() => {
      expect(within(row).getByText("대기 중")).toBeInTheDocument()
    })
    expect(fetch).toHaveBeenCalledWith(
      "/api/statements/statement-1/retry",
      { method: "POST" }
    )
    expect(within(row).queryByRole("button", { name: "재시도" })).toBeNull()
  })

  it("polls existing in-progress statements every 2 seconds at most 150 times", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          ...completedStatement,
          status: "processing",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    )

    render(
      <StatementUploadManager
        plan="pro"
        initialAccounts={accounts}
        initialStatements={[
          { ...completedStatement, status: "processing" },
        ]}
      />
    )

    await act(() => vi.advanceTimersByTimeAsync(1_999))
    expect(fetchMock).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(300_000))
    expect(fetchMock).toHaveBeenCalledTimes(150)
    vi.useRealTimers()
  })

  it("renders untrusted statement text as plain content", () => {
    render(
      <StatementUploadManager
        plan="pro"
        initialAccounts={accounts}
        initialStatements={[
          {
            ...completedStatement,
            fileName: '<img src=x onerror="alert(1)">.csv',
          },
        ]}
      />
    )

    expect(
      screen.getByText('<img src=x onerror="alert(1)">.csv')
    ).toBeInTheDocument()
    expect(document.querySelector("img")).toBeNull()
  })
})
