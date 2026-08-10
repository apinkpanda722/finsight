import type { SupabaseClient } from "@supabase/supabase-js"

import { decodeCsvBuffer } from "@/lib/csv/decode"
import { parseCsv } from "@/lib/csv/parse"
import { isPdfBuffer, parsePdf } from "@/lib/pdf/parse"
import type {
  ApiErrorCode,
  CompleteUploadResponse,
  InitStatementUploadResponse,
  StatementStatus,
  StatementStatusResponse,
} from "@/types/domain"
import type { Database, Tables } from "@/types/supabase"

const MAX_FILE_SIZE_BYTES = 5_242_880
const MAX_ROW_COUNT = 2_000
const STATEMENTS_BUCKET = "statements"

export const ERROR_MESSAGES = {
  upload_missing: "업로드된 파일을 찾을 수 없습니다.",
  file_too_large: "파일이 5MB를 초과합니다.",
  encoding_error: "인코딩 또는 CSV 형식을 인식할 수 없습니다.",
  invalid_csv: "CSV 구조를 읽을 수 없습니다.",
  invalid_pdf: "PDF 표 구조를 읽을 수 없습니다.",
} as const

export type ValidationFailureCode = keyof typeof ERROR_MESSAGES

type StatementUploadDeps = {
  supabase: SupabaseClient<Database>
}

export type InitStatementUploadInput = {
  fileName: string
  declaredSizeBytes: number
}

type UnknownRecord = Record<string, unknown>

export class StatementUploadError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly httpStatus: number
  ) {
    super(message)
    this.name = "StatementUploadError"
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  if (!isRecord(error)) return ""

  return [error.message, error.details, error.hint, error.code]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
}

function mapRpcError(error: unknown): StatementUploadError {
  const text = errorText(error)

  if (text.includes("rate_limited")) {
    return new StatementUploadError(
      "rate_limited",
      "24시간 업로드 제한에 도달했습니다.",
      429
    )
  }
  if (text.includes("profile_not_found")) {
    return new StatementUploadError(
      "not_found",
      "프로필을 찾을 수 없습니다.",
      404
    )
  }

  return new StatementUploadError(
    "internal_error",
    "업로드를 시작할 수 없습니다.",
    500
  )
}

function internalError(message: string): StatementUploadError {
  return new StatementUploadError("internal_error", message, 500)
}

function toStatementStatus(value: string): StatementStatus {
  if (
    value === "uploading" ||
    value === "pending" ||
    value === "processing" ||
    value === "completed" ||
    value === "failed"
  ) {
    return value
  }

  throw internalError("명세서 상태를 확인할 수 없습니다.")
}

function isMissingStorageError(error: unknown): boolean {
  if (!isRecord(error)) return false

  return (
    error.status === 404 ||
    error.statusCode === "404" ||
    error.code === "NoSuchKey" ||
    error.code === "not_found"
  )
}

async function createUploadToken(
  storagePath: string,
  deps: StatementUploadDeps
): Promise<string> {
  const { data, error } = await deps.supabase.storage
    .from(STATEMENTS_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: true })

  if (error || !data?.token) {
    throw internalError("업로드 URL을 발급할 수 없습니다.")
  }

  return data.token
}

export async function initStatementUpload(
  userId: string,
  input: InitStatementUploadInput,
  deps: StatementUploadDeps
): Promise<InitStatementUploadResponse> {
  let rpcResult: Awaited<
    ReturnType<typeof deps.supabase.rpc<"create_statement_upload">>
  >

  try {
    rpcResult = await deps.supabase.rpc("create_statement_upload", {
      p_user_id: userId,
      p_file_name: input.fileName,
      p_declared_size: input.declaredSizeBytes,
    })
  } catch (error) {
    throw mapRpcError(error)
  }

  if (rpcResult.error) throw mapRpcError(rpcResult.error)

  const created = rpcResult.data?.[0]
  if (!created) {
    throw internalError("업로드 정보를 만들 수 없습니다.")
  }

  const uploadToken = await createUploadToken(created.storage_path, deps)

  return {
    statementId: created.statement_id,
    storagePath: created.storage_path,
    uploadToken,
    status: "uploading",
  }
}

export async function getOwnedStatement(
  userId: string,
  statementId: string,
  deps: StatementUploadDeps
): Promise<Tables<"uploaded_statements"> | null> {
  const { data, error } = await deps.supabase
    .from("uploaded_statements")
    .select("*")
    .eq("id", statementId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw internalError("명세서를 확인할 수 없습니다.")

  return data
}

export async function reissueUploadUrl(
  userId: string,
  statementId: string,
  deps: StatementUploadDeps
): Promise<{ uploadToken: string }> {
  const statement = await getOwnedStatement(userId, statementId, deps)

  if (!statement) {
    throw new StatementUploadError(
      "not_found",
      "명세서를 찾을 수 없습니다.",
      404
    )
  }
  if (statement.status !== "uploading") {
    throw new StatementUploadError(
      "conflict",
      "업로드 중인 명세서만 URL을 재발급할 수 있습니다.",
      409
    )
  }

  return { uploadToken: await createUploadToken(statement.storage_path, deps) }
}

export async function markValidationFailed(
  statementId: string,
  failureCode: ValidationFailureCode,
  deps: StatementUploadDeps,
  options: { removeStorage?: boolean; storagePath?: string } = {}
): Promise<void> {
  const { error } = await deps.supabase
    .from("uploaded_statements")
    .update({
      status: "failed",
      failure_code: failureCode,
      error_message: ERROR_MESSAGES[failureCode],
      updated_at: new Date().toISOString(),
    })
    .eq("id", statementId)

  if (error) throw internalError("명세서 검증 실패 상태를 저장할 수 없습니다.")

  if (options.removeStorage && options.storagePath) {
    try {
      await deps.supabase.storage
        .from(STATEMENTS_BUCKET)
        .remove([options.storagePath])
    } catch {
      // The failed DB status is authoritative; Storage cleanup is best-effort.
    }
  }
}

async function failValidation(
  statement: Tables<"uploaded_statements">,
  failureCode: ValidationFailureCode,
  clientMessage: string,
  deps: StatementUploadDeps,
  removeStorage = false
): Promise<never> {
  await markValidationFailed(statement.id, failureCode, deps, {
    removeStorage,
    storagePath: statement.storage_path,
  })
  throw new StatementUploadError("validation_error", clientMessage, 422)
}

export async function completeStatementUpload(
  userId: string,
  statementId: string,
  deps: StatementUploadDeps
): Promise<CompleteUploadResponse> {
  const statement = await getOwnedStatement(userId, statementId, deps)

  if (!statement) {
    throw new StatementUploadError(
      "not_found",
      "명세서를 찾을 수 없습니다.",
      404
    )
  }

  if (statement.status !== "uploading") {
    return {
      statementId: statement.id,
      status: toStatementStatus(statement.status),
    }
  }

  const { data: fileData, error: downloadError } = await deps.supabase.storage
    .from(STATEMENTS_BUCKET)
    .download(statement.storage_path)

  if (downloadError || !fileData) {
    return failValidation(
      statement,
      "upload_missing",
      "업로드된 파일을 찾을 수 없습니다.",
      deps
    )
  }

  const buf = Buffer.from(await fileData.arrayBuffer())
  if (buf.byteLength > MAX_FILE_SIZE_BYTES) {
    return failValidation(
      statement,
      "file_too_large",
      "파일이 5MB를 초과합니다.",
      deps,
      true
    )
  }

  let rowCount: number
  if (isPdfBuffer(buf)) {
    try {
      rowCount = (await parsePdf(buf)).rows.length
    } catch {
      return failValidation(
        statement,
        "invalid_pdf",
        "PDF 표 구조를 읽을 수 없습니다.",
        deps,
        true
      )
    }
  } else {
    let text: string
    try {
      text = decodeCsvBuffer(buf).text
    } catch {
      return failValidation(
        statement,
        "encoding_error",
        "인코딩 또는 CSV 형식을 인식할 수 없습니다.",
        deps,
        true
      )
    }

    try {
      rowCount = parseCsv(text).rows.length
    } catch {
      return failValidation(
        statement,
        "invalid_csv",
        "CSV 구조를 읽을 수 없습니다.",
        deps,
        true
      )
    }
  }

  if (rowCount < 1 || rowCount > MAX_ROW_COUNT) {
    return failValidation(
      statement,
      "invalid_csv",
      "최대 2,000행까지 지원합니다. 기간을 나눠 다시 업로드해주세요.",
      deps,
      true
    )
  }

  const { error: updateError } = await deps.supabase
    .from("uploaded_statements")
    .update({
      status: "pending",
      file_size_bytes: buf.byteLength,
      row_count: rowCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", statement.id)

  if (updateError) {
    throw internalError("명세서 검증 결과를 저장할 수 없습니다.")
  }

  return { statementId: statement.id, status: "pending" }
}

export async function getStatementStatus(
  userId: string,
  statementId: string,
  deps: StatementUploadDeps
): Promise<StatementStatusResponse> {
  const statement = await getOwnedStatement(userId, statementId, deps)

  if (!statement) {
    throw new StatementUploadError(
      "not_found",
      "명세서를 찾을 수 없습니다.",
      404
    )
  }

  const leaseExpired =
    statement.status === "processing" &&
    statement.processing_lease_expires_at !== null &&
    new Date(statement.processing_lease_expires_at).getTime() < Date.now()

  return {
    statementId: statement.id,
    fileName: statement.file_name,
    detectedLabel: statement.detected_label,
    status: toStatementStatus(statement.status),
    rowCount: statement.row_count,
    errorMessage: statement.error_message,
    createdAt: statement.created_at,
    updatedAt: statement.updated_at,
    retryable: statement.status === "failed" || leaseExpired,
  }
}

export async function retryStatement(
  userId: string,
  statementId: string,
  deps: StatementUploadDeps
): Promise<boolean> {
  const statement = await getOwnedStatement(userId, statementId, deps)
  if (!statement) {
    throw new StatementUploadError(
      "not_found",
      "명세서를 찾을 수 없습니다.",
      404
    )
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const expired =
    statement.status === "processing" &&
    statement.processing_lease_expires_at !== null &&
    new Date(statement.processing_lease_expires_at).getTime() < now.getTime()
  if (statement.status !== "failed" && !expired) {
    throw new StatementUploadError(
      "conflict",
      "현재 상태에서는 분석을 재시도할 수 없습니다.",
      409
    )
  }

  let update = deps.supabase
    .from("uploaded_statements")
    .update({
      status: "pending",
      processing_lease_expires_at: null,
      failure_code: null,
      error_message: null,
      updated_at: nowIso,
    })
    .eq("id", statementId)
    .eq("user_id", userId)
    .eq("status", statement.status)

  if (expired) {
    update = update.lt("processing_lease_expires_at", nowIso)
  }

  const { data, error } = await update.select("id").maybeSingle()
  if (error) throw internalError("명세서 재시도를 예약할 수 없습니다.")
  if (!data) {
    throw new StatementUploadError(
      "conflict",
      "명세서 상태가 변경되어 재시도할 수 없습니다.",
      409
    )
  }

  return true
}

export async function deleteOwnedStatement(
  userId: string,
  statementId: string,
  deps: StatementUploadDeps
): Promise<boolean> {
  const statement = await getOwnedStatement(userId, statementId, deps)
  if (!statement) return false

  const { error: storageError } = await deps.supabase.storage
    .from(STATEMENTS_BUCKET)
    .remove([statement.storage_path])

  if (storageError && !isMissingStorageError(storageError)) {
    throw internalError("원본 파일을 삭제할 수 없습니다.")
  }

  const { error: deleteError } = await deps.supabase
    .from("uploaded_statements")
    .delete()
    .eq("id", statementId)
    .eq("user_id", userId)

  if (deleteError) {
    throw internalError("명세서를 삭제할 수 없습니다.")
  }

  return true
}
