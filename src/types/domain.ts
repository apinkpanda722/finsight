export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "validation_error"
  | "rate_limited"
  | "not_found"
  | "conflict"
  | "internal_error"

export const TRANSACTION_CATEGORIES = [
  "food_dining",
  "groceries",
  "transport",
  "shopping",
  "entertainment",
  "utilities",
  "housing",
  "healthcare",
  "education",
  "travel",
  "subscriptions",
  "income",
  "transfer",
  "fees",
  "other",
] as const

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number]

export type StatementStatus =
  | "uploading"
  | "pending"
  | "processing"
  | "completed"
  | "failed"

export type InitStatementUploadResponse = {
  statementId: string
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
  fileName: string
  detectedLabel: string | null
  status: StatementStatus
  rowCount: number | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  retryable: boolean
}
