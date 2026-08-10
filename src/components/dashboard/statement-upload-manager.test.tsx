import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const uiMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  uploadToSignedUrl: vi.fn(),
  routerReplace: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: uiMocks.createClient,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: uiMocks.routerReplace }),
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
  it("stays closed by default", () => {
    render(
      <StatementUploadManager
        plan="free"
        initialAccounts={accounts}
        initialStatements={[]}
      />
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens the upload dialog on mount when initialUploadOpen is set", () => {
    render(
      <StatementUploadManager
        plan="free"
        initialAccounts={accounts}
        initialStatements={[]}
        initialUploadOpen
      />
    )

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("명세서 업로드")).toBeInTheDocument()
  })

  it("does not auto-open the upload dialog for a zero-account user, and focuses the new account name input instead", () => {
    render(
      <StatementUploadManager
        plan="free"
        initialAccounts={[]}
        initialStatements={[]}
        initialUploadOpen
      />
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByLabelText("신규 계좌 이름")).toHaveFocus()
  })

  it("strips the one-shot upload=1 intent from the URL after mount", () => {
    render(
      <StatementUploadManager
        plan="free"
        initialAccounts={accounts}
        initialStatements={[]}
        initialUploadOpen
      />
    )

    expect(uiMocks.routerReplace).toHaveBeenCalledWith("/uploads")
  })

  it("does not touch the URL when initialUploadOpen is not set", () => {
    render(
      <StatementUploadManager
        plan="free"
        initialAccounts={accounts}
        initialStatements={[]}
      />
    )

    expect(uiMocks.routerReplace).not.toHaveBeenCalled()
  })

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

    await user.click(screen.getByRole("button", { name: "CSV/PDF 업로드" }))
    const file = new File(["date,amount\n2026-08-07,12000"], "statement.csv", {
      type: "text/csv",
    })
    await user.upload(screen.getByLabelText("CSV/PDF 파일"), file)
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

  it("uploads a PDF statement with the application/pdf content type", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statementId: "statement-3",
            accountId: "account-1",
            storagePath: "user-id/statement-3",
            uploadToken: "pdf-token",
            status: "uploading",
          }),
          { status: 201, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ statementId: "statement-3", status: "pending" }),
          { status: 202, headers: { "content-type": "application/json" } }
        )
      )

    render(
      <StatementUploadManager
        plan="free"
        initialAccounts={[accounts[0]]}
        initialStatements={[]}
      />
    )

    await user.click(screen.getByRole("button", { name: "CSV/PDF 업로드" }))
    const file = new File(["%PDF-1.7 fake"], "statement.pdf", {
      type: "application/pdf",
    })
    await user.upload(screen.getByLabelText("CSV/PDF 파일"), file)
    await user.click(
      screen.getByRole("checkbox", {
        name: /Supabase Storage와 Anthropic/,
      })
    )
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    await screen.findByText("처리 대기 중")
    expect(uiMocks.uploadToSignedUrl).toHaveBeenCalledWith(
      "user-id/statement-3",
      "pdf-token",
      file,
      expect.objectContaining({ contentType: "application/pdf" })
    )
  })

  it("shows a drag-active state while a file is dragged over the dropzone, and clears it on drag leave", async () => {
    const user = userEvent.setup()
    render(
      <StatementUploadManager
        plan="free"
        initialAccounts={[accounts[0]]}
        initialStatements={[]}
      />
    )

    await user.click(screen.getByRole("button", { name: "CSV/PDF 업로드" }))
    const dropzone = screen.getByTestId("statement-dropzone")

    fireEvent.dragOver(dropzone)
    expect(dropzone).toHaveAttribute("data-dragging", "true")

    fireEvent.dragLeave(dropzone)
    expect(dropzone).not.toHaveAttribute("data-dragging")
  })

  it("selects a file dropped onto the dropzone, same as picking one via the file input", async () => {
    const user = userEvent.setup()
    render(
      <StatementUploadManager
        plan="free"
        initialAccounts={[accounts[0]]}
        initialStatements={[]}
      />
    )

    await user.click(screen.getByRole("button", { name: "CSV/PDF 업로드" }))
    const dropzone = screen.getByTestId("statement-dropzone")
    const file = new File(["date,amount\n2026-08-07,12000"], "dropped.csv", {
      type: "text/csv",
    })

    fireEvent.dragOver(dropzone)
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    expect(screen.getByText("dropped.csv")).toBeInTheDocument()
    expect(dropzone).not.toHaveAttribute("data-dragging")

    await user.click(
      screen.getByRole("checkbox", {
        name: /Supabase Storage와 Anthropic/,
      })
    )
    expect(
      screen.getByRole("button", { name: "업로드 시작" })
    ).not.toBeDisabled()
  })

  it("rejects a file extension that is neither .csv nor .pdf", async () => {
    // user-event filters uploads against the input's `accept` attribute by
    // default, so this bypasses that to exercise the app's own extension check.
    const user = userEvent.setup({ applyAccept: false })
    render(
      <StatementUploadManager
        plan="free"
        initialAccounts={[accounts[0]]}
        initialStatements={[]}
      />
    )

    await user.click(screen.getByRole("button", { name: "CSV/PDF 업로드" }))
    await user.upload(
      screen.getByLabelText("CSV/PDF 파일"),
      new File(["not a statement"], "statement.txt", { type: "text/plain" })
    )
    await user.click(
      screen.getByRole("checkbox", {
        name: /Supabase Storage와 Anthropic/,
      })
    )
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "CSV 또는 PDF 파일만 업로드할 수 있습니다."
    )
    expect(fetch).not.toHaveBeenCalled()
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

    await user.click(screen.getByRole("button", { name: "CSV/PDF 업로드" }))
    await user.upload(
      screen.getByLabelText("CSV/PDF 파일"),
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
    await user.click(screen.getByRole("button", { name: "CSV/PDF 업로드" }))
    await user.upload(
      screen.getByLabelText("CSV/PDF 파일"),
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
