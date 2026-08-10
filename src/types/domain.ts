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

export const CATEGORY_LABELS: Record<string, string> = {
  food_dining: "식비",
  groceries: "장보기",
  transport: "교통",
  shopping: "쇼핑",
  entertainment: "여가",
  utilities: "공과금",
  housing: "주거",
  healthcare: "의료",
  education: "교육",
  travel: "여행",
  subscriptions: "구독",
  income: "수입",
  transfer: "이체",
  fees: "수수료",
  other: "기타",
}

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
