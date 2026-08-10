"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { usePendingUpload } from "@/components/dashboard/pending-upload-context"
import { createClient } from "@/lib/supabase/client"
import type {
  ApiErrorCode,
  CompleteUploadResponse,
  InitStatementUploadResponse,
  StatementStatus,
  StatementStatusResponse,
} from "@/types/domain"

const MAX_FILE_SIZE_BYTES = 5_242_880

const STATUS_LABEL: Record<StatementStatus, string> = {
  uploading: "업로드 중",
  pending: "대기 중",
  processing: "분석 중",
  completed: "완료",
  failed: "실패",
}

const STATUS_COLOR: Record<StatementStatus, string> = {
  uploading: "var(--color-muted)",
  pending: "var(--color-muted)",
  processing: "var(--color-primary)",
  completed: "var(--color-semantic-up)",
  failed: "var(--color-semantic-down)",
}

export type UploadAccount = {
  id: string
  label: string
}

export type UploadStatement = StatementStatusResponse

type ApiErrorBody = {
  error?: ApiErrorCode
  message?: string
}

type StatementUploadManagerProps = {
  plan: "free" | "pro"
  initialAccounts: UploadAccount[]
  initialStatements: UploadStatement[]
  initialUploadOpen?: boolean
}

function formatUploadedAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value))
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

export function StatusBadge({ status }: { status: StatementStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold"
      style={{ color: STATUS_COLOR[status] }}
    >
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full"
        style={{ backgroundColor: STATUS_COLOR[status] }}
      />
      {STATUS_LABEL[status]}
    </span>
  )
}

function StatementRow({
  statement,
  onDelete,
  onRetry,
}: {
  statement: UploadStatement
  onDelete: (statementId: string) => Promise<void>
  onRetry: (statementId: string) => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [retrying, setRetrying] = useState(false)

  async function confirmDelete() {
    setDeleting(true)
    try {
      await onDelete(statement.statementId)
    } finally {
      setDeleting(false)
    }
  }

  async function retry() {
    setRetrying(true)
    try {
      await onRetry(statement.statementId)
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div
      data-testid={`statement-${statement.statementId}`}
      className="flex flex-col gap-3 border-t border-border py-4 first:border-t-0 sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {statement.fileName}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          업로드 <span className="financial-number">{formatUploadedAt(statement.createdAt)}</span>
          {statement.rowCount == null ? (
            " · 행 수 확인 중"
          ) : (
            <>
              {" · "}
              <span className="financial-number">{statement.rowCount}</span>건
            </>
          )}
        </p>
        {statement.errorMessage ? (
          <p className="mt-1 text-xs text-[var(--color-semantic-down)]">
            {statement.errorMessage}
          </p>
        ) : null}
      </div>

      <StatusBadge status={statement.status} />

      <div className="flex min-h-7 min-w-[156px] items-center justify-end gap-2">
        {confirming ? (
          <>
            <span className="text-xs text-[var(--color-body)]">삭제할까요?</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="px-1.5 text-[var(--color-semantic-down)] hover:bg-transparent hover:text-[var(--color-semantic-down)]"
              disabled={deleting}
              aria-label="삭제 확인"
              onClick={confirmDelete}
            >
              삭제
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="px-1.5 text-muted-foreground hover:bg-transparent"
              disabled={deleting}
              onClick={() => setConfirming(false)}
            >
              취소
            </Button>
          </>
        ) : (
          <>
            {statement.retryable ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={retrying}
                onClick={retry}
              >
                재시도
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              disabled={retrying}
              onClick={() => setConfirming(true)}
            >
              삭제
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export function StatementUploadManager({
  plan,
  initialAccounts,
  initialStatements,
  initialUploadOpen = false,
}: StatementUploadManagerProps) {
  const router = useRouter()
  const { takePendingFile } = usePendingUpload()
  const [accounts, setAccounts] = useState(initialAccounts)
  const [statements, setStatements] = useState(initialStatements)
  const [selectedAccountId, setSelectedAccountId] = useState(
    initialAccounts[0]?.id ?? ""
  )
  const [newAccountLabel, setNewAccountLabel] = useState("")
  const [uploadOpen, setUploadOpen] = useState(
    initialUploadOpen && initialAccounts.length > 0
  )
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const newAccountInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [consent, setConsent] = useState(false)
  const [step, setStep] = useState<"select" | StatementStatus>("select")
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [activeStatementId, setActiveStatementId] = useState<string | null>(null)
  const pollCountsRef = useRef(new Map<string, number>())
  const pollingRequestsRef = useRef(new Set<string>())

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  )

  useEffect(() => {
    if (!initialUploadOpen) return
    router.replace("/uploads")
    const pendingFile = takePendingFile()
    if (pendingFile) setFile(pendingFile)
    if (initialAccounts.length === 0) {
      newAccountInputRef.current?.focus()
    }
  }, [initialAccounts.length, initialUploadOpen, router, takePendingFile])

  const pollingKey = useMemo(
    () =>
      statements
        .filter(
          (statement) =>
            statement.status === "pending" || statement.status === "processing"
        )
        .map((statement) => statement.statementId)
        .join(","),
    [statements]
  )

  useEffect(() => {
    const statementIds = pollingKey ? pollingKey.split(",") : []
    if (statementIds.length === 0) return

    const timer = window.setInterval(() => {
      for (const statementId of statementIds) {
        const pollCount = pollCountsRef.current.get(statementId) ?? 0
        if (
          pollCount >= 150 ||
          pollingRequestsRef.current.has(statementId)
        ) {
          continue
        }

        pollCountsRef.current.set(statementId, pollCount + 1)
        pollingRequestsRef.current.add(statementId)
        void (async () => {
          try {
            const response = await fetch(`/api/statements/${statementId}`)
            if (!response.ok) return
            const current = await readJson<StatementStatusResponse>(response)
            if (statementId === activeStatementId) setStep(current.status)
            if (
              current.status !== "pending" &&
              current.status !== "processing"
            ) {
              pollCountsRef.current.delete(statementId)
            }
            setStatements((items) =>
              items.map((item) =>
                item.statementId === current.statementId ? current : item
              )
            )
          } catch {
            // A later poll can recover from a transient status request failure.
          } finally {
            pollingRequestsRef.current.delete(statementId)
          }
        })()
      }
    }, 2_000)

    return () => window.clearInterval(timer)
  }, [activeStatementId, pollingKey])

  function resetUpload() {
    setFile(null)
    setIsDragging(false)
    setConsent(false)
    setStep("select")
    setProgress(0)
    setUploadError(null)
    setActiveStatementId(null)
  }

  function handleFileSelect(nextFile: File | null) {
    setFile(nextFile)
    setUploadError(null)
  }

  function changeUploadOpen(open: boolean) {
    setUploadOpen(open)
    if (!open) resetUpload()
  }

  function chooseAccount(account: UploadAccount, index: number) {
    if (plan === "free" && index > 0) {
      setUpgradeOpen(true)
      return
    }

    setSelectedAccountId(account.id)
    setNewAccountLabel("")
  }

  function chooseNewAccount() {
    if (plan === "free" && accounts.length > 0) {
      setUpgradeOpen(true)
      return
    }

    setSelectedAccountId("")
  }

  async function uploadToStorage(
    statementId: string,
    storagePath: string,
    uploadToken: string,
    selectedFile: File
  ): Promise<boolean> {
    const supabase = createClient()
    const bucket = supabase.storage.from("statements")
    const options = {
      contentType:
        selectedFile.type ||
        (selectedFile.name.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "text/csv"),
    }
    const firstAttempt = await bucket.uploadToSignedUrl(
      storagePath,
      uploadToken,
      selectedFile,
      options
    )
    if (!firstAttempt.error) return true

    const tokenResponse = await fetch(
      `/api/statements/${statementId}/upload-url`,
      { method: "POST" }
    )
    if (!tokenResponse.ok) return false
    const replacement = await readJson<{ uploadToken: string }>(tokenResponse)
    const secondAttempt = await bucket.uploadToSignedUrl(
      storagePath,
      replacement.uploadToken,
      selectedFile,
      options
    )

    return !secondAttempt.error
  }

  async function startUpload() {
    if (!file || !consent) return
    const lowerFileName = file.name.toLowerCase()
    if (!lowerFileName.endsWith(".csv") && !lowerFileName.endsWith(".pdf")) {
      setUploadError("CSV 또는 PDF 파일만 업로드할 수 있습니다.")
      return
    }
    if (file.size < 1 || file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError("파일은 5MB 이하여야 합니다.")
      return
    }
    if (!selectedAccountId && !newAccountLabel.trim()) {
      setUploadError("계좌를 선택하거나 신규 계좌 이름을 입력해주세요.")
      return
    }

    setUploadError(null)
    setStep("uploading")
    setProgress(8)

    try {
      const initResponse = await fetch("/api/statements/init-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(selectedAccountId
            ? { accountId: selectedAccountId }
            : { newAccountLabel: newAccountLabel.trim() }),
          fileName: file.name,
          declaredSizeBytes: file.size,
        }),
      })

      if (!initResponse.ok) {
        const apiFailure = await readJson<ApiErrorBody>(initResponse)
        if (
          initResponse.status === 403 &&
          apiFailure.error === "upgrade_required"
        ) {
          setUploadOpen(false)
          resetUpload()
          setUpgradeOpen(true)
          return
        }
        if (initResponse.status === 429) {
          setStep("select")
          setUploadError(
            apiFailure.message ?? "24시간 업로드 제한에 도달했습니다."
          )
          return
        }
        throw new Error("init_failed")
      }

      const initialized = await readJson<InitStatementUploadResponse>(initResponse)
      setActiveStatementId(initialized.statementId)
      setProgress(24)

      const uploaded = await uploadToStorage(
        initialized.statementId,
        initialized.storagePath,
        initialized.uploadToken,
        file
      )
      if (!uploaded) throw new Error("storage_failed")
      setProgress(78)

      const completeResponse = await fetch(
        `/api/statements/${initialized.statementId}/complete-upload`,
        { method: "POST" }
      )
      if (!completeResponse.ok) {
        const apiFailure = await readJson<ApiErrorBody>(completeResponse)
        setUploadError(apiFailure.message ?? "파일을 검증할 수 없습니다.")
        setStep("failed")
        return
      }

      const completed = await readJson<CompleteUploadResponse>(completeResponse)
      const now = new Date().toISOString()
      const nextStatement: UploadStatement = {
        statementId: initialized.statementId,
        accountId: initialized.accountId,
        fileName: file.name,
        status: completed.status,
        rowCount: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        retryable: false,
      }
      setStatements((items) => [nextStatement, ...items])
      if (!selectedAccountId) {
        setAccounts((items) => [
          ...items,
          { id: initialized.accountId, label: newAccountLabel.trim() },
        ])
        setSelectedAccountId(initialized.accountId)
      }
      setProgress(100)
      setStep(completed.status)
    } catch {
      setUploadError(
        "업로드를 완료할 수 없습니다. 네트워크 상태를 확인하고 다시 시도해주세요."
      )
      setStep("failed")
    }
  }

  async function deleteStatement(statementId: string) {
    setPageError(null)
    const response = await fetch(`/api/statements/${statementId}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      setPageError("명세서를 삭제할 수 없습니다. 잠시 후 다시 시도해주세요.")
      return
    }

    setStatements((items) =>
      items.filter((item) => item.statementId !== statementId)
    )
  }

  async function retryStatement(statementId: string) {
    setPageError(null)
    const response = await fetch(`/api/statements/${statementId}/retry`, {
      method: "POST",
    })
    if (!response.ok) {
      setPageError("분석을 재시도할 수 없습니다. 상태를 새로 확인해주세요.")
      return
    }

    setStatements((items) =>
      items.map((item) =>
        item.statementId === statementId
          ? {
              ...item,
              status: "pending",
              retryable: false,
              errorMessage: null,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    )
    pollCountsRef.current.set(statementId, 0)
    setActiveStatementId(statementId)
    setStep("pending")
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2" aria-label="계좌 선택">
        {accounts.map((account, index) => {
          const locked = plan === "free" && index > 0
          const active = selectedAccountId === account.id
          return (
            <button
              key={account.id}
              type="button"
              aria-pressed={active}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                active
                  ? "bg-[var(--color-ink)] text-[var(--color-on-dark)]"
                  : "bg-[var(--color-surface-strong)] text-foreground"
              } ${locked ? "opacity-55" : ""}`}
              onClick={() => chooseAccount(account, index)}
            >
              {account.label}
              {locked ? " 🔒" : ""}
            </button>
          )
        })}
        <button
          type="button"
          aria-pressed={selectedAccountId === ""}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground"
          onClick={chooseNewAccount}
        >
          신규 계좌
          {plan === "free" && accounts.length > 0 ? " 🔒" : ""}
        </button>
      </div>

      {selectedAccountId === "" ? (
        <div className="mb-6 max-w-sm">
          <label htmlFor="new-account-label" className="mb-2 block text-sm font-medium">
            신규 계좌 이름
          </label>
          <Input
            id="new-account-label"
            ref={newAccountInputRef}
            value={newAccountLabel}
            maxLength={80}
            className="h-11 px-4"
            placeholder="예: 신한카드"
            onChange={(event) => setNewAccountLabel(event.target.value)}
          />
        </div>
      ) : null}

      {pageError ? (
        <p
          role="alert"
          className="mb-4 rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm"
        >
          {pageError}
        </p>
      ) : null}

      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">업로드한 명세서</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {(activeAccount?.label ?? newAccountLabel.trim()) || "신규 계좌"}의 CSV/PDF 원본과 처리 상태입니다.
          </p>
        </div>
        <Button type="button" className="h-11 px-5" onClick={() => setUploadOpen(true)}>
          CSV/PDF 업로드
        </Button>
      </div>

      <section className="rounded-[var(--radius-xl)] border border-border bg-background px-6 py-2">
        <div className="flex items-center justify-between py-4">
          <h3 className="font-heading text-lg font-semibold">명세서 목록</h3>
          <Badge variant="secondary" className="financial-number">
            {statements.length}건
          </Badge>
        </div>
        {statements.length === 0 ? (
          <p className="border-t border-border py-8 text-sm text-muted-foreground">
            업로드된 명세서가 없습니다.
          </p>
        ) : (
          statements.map((statement) => (
            <StatementRow
              key={statement.statementId}
              statement={statement}
              onDelete={deleteStatement}
              onRetry={retryStatement}
            />
          ))
        )}
      </section>

      <Dialog open={uploadOpen} onOpenChange={changeUploadOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100%-2rem)] max-w-[460px] rounded-[var(--radius-xl)] border-border p-8"
        >
          {step === "select" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">명세서 업로드</DialogTitle>
                <DialogDescription>
                  은행 또는 카드사에서 내려받은 CSV 또는 PDF 파일을 업로드하세요.
                </DialogDescription>
              </DialogHeader>

              <div
                data-testid="statement-dropzone"
                data-dragging={isDragging ? "true" : undefined}
                className={`mt-2 rounded-[var(--radius-md)] border border-dashed px-4 py-7 text-center text-sm transition-colors ${
                  isDragging
                    ? "border-primary bg-[var(--color-surface-soft)] text-foreground"
                    : "border-border text-muted-foreground"
                }`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setIsDragging(false)
                  handleFileSelect(event.dataTransfer.files?.[0] ?? null)
                }}
              >
                <label htmlFor="statement-file-input" className="block cursor-pointer">
                  <span className={file ? "financial-number text-foreground" : ""}>
                    {file ? file.name : "클릭하거나 파일을 끌어다 놓으세요 (CSV/PDF)"}
                  </span>
                  <input
                    id="statement-file-input"
                    type="file"
                    accept=".csv,.pdf,text/csv,application/pdf"
                    className="sr-only"
                    aria-label="CSV/PDF 파일"
                    onChange={(event) =>
                      handleFileSelect(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
              </div>

              <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[var(--color-body)]">
                <input
                  type="checkbox"
                  checked={consent}
                  className="mt-1 size-4 rounded border-border accent-[var(--color-primary)]"
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  업로드한 원본 파일은 처리를 위해 Supabase Storage와 Anthropic(Claude API)에 전달되는 것에 동의합니다.
                </span>
              </label>

              {uploadError ? (
                <p
                  role="alert"
                  className="rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-body)]"
                >
                  {uploadError}
                </p>
              ) : null}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1"
                  onClick={() => changeUploadOpen(false)}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  className="h-11 flex-1"
                  disabled={!file || !consent}
                  onClick={startUpload}
                >
                  업로드 시작
                </Button>
              </div>
            </>
          ) : null}

          {step === "uploading" ? (
            <div className="py-2">
              <DialogTitle className="mb-5 text-xl">업로드 중</DialogTitle>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-strong)]"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="financial-number mt-3 text-sm text-muted-foreground">
                {progress}%
              </p>
            </div>
          ) : null}

          {step === "pending" || step === "processing" ? (
            <div className="py-2 text-center">
              <DialogTitle className="text-xl">
                {step === "pending" ? "처리 대기 중" : "거래 내역 분석 중"}
              </DialogTitle>
              <DialogDescription className="mt-2">
                {step === "pending"
                  ? "원본 파일 검증을 마쳤습니다. 분석을 준비하고 있습니다."
                  : "Claude가 컬럼을 매핑하고 카테고리를 분류하고 있습니다."}
              </DialogDescription>
              <Button
                type="button"
                variant="outline"
                className="mt-6 h-11 px-6"
                onClick={() => changeUploadOpen(false)}
              >
                닫기
              </Button>
            </div>
          ) : null}

          {step === "completed" ? (
            <div className="py-2">
              <DialogTitle className="text-xl">분석이 완료되었습니다</DialogTitle>
              <DialogDescription className="mt-2">
                거래 내역을 확인하고 카테고리별로 정리했습니다.
              </DialogDescription>
              <Button asChild className="mt-6 h-11 w-full">
                <Link href="/dashboard">결과 보기</Link>
              </Button>
            </div>
          ) : null}

          {step === "failed" ? (
            <div className="py-2">
              <DialogTitle className="text-xl text-[var(--color-semantic-down)]">
                처리에 실패했습니다
              </DialogTitle>
              <DialogDescription className="mt-2">
                {uploadError ?? "파일 형식을 확인한 뒤 다시 업로드해주세요."}
              </DialogDescription>
              <Button
                type="button"
                variant="outline"
                className="mt-6 h-11 w-full"
                onClick={() => changeUploadOpen(false)}
              >
                닫기
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100%-2rem)] max-w-[420px] rounded-[var(--radius-xl)] border-border p-8"
        >
          <DialogHeader>
            <DialogTitle className="text-xl">Pro 요금제가 필요합니다</DialogTitle>
            <DialogDescription>
              Free 요금제는 계좌 한 개를 지원합니다. Pro에서는 계좌를 제한 없이 추가할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={() => setUpgradeOpen(false)}
            >
              닫기
            </Button>
            <form method="POST" action="/api/checkout" className="flex-1">
              <Button type="submit" className="h-11 w-full">
                Pro로 업그레이드
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
