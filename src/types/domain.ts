export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "validation_error"
  | "rate_limited"
  | "upgrade_required"
  | "not_found"
  | "conflict"
  | "internal_error"

export type StatementStatus =
  | "uploading"
  | "pending"
  | "processing"
  | "completed"
  | "failed"

export type InitStatementUploadResponse = {
  statementId: string
  accountId: string
  storagePath: string
  uploadToken: string
  status: "uploading"
}

export type CompleteUploadResponse = {
  statementId: string
  status: StatementStatus
}

export type StatementStatusResponse = {
  statementId: string
  accountId: string
  fileName: string
  status: StatementStatus
  rowCount: number | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  retryable: boolean
}
