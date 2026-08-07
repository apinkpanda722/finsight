import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { requireUserId, UnauthorizedError } from "@/lib/api/auth"
import { apiError } from "@/lib/api/response"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  initStatementUpload,
  StatementUploadError,
} from "@/services/statementUploadService"

const initUploadSchema = z
  .object({
    accountId: z.uuid().optional(),
    newAccountLabel: z.string().trim().min(1).max(80).optional(),
    fileName: z.string().trim().min(1).max(255),
    declaredSizeBytes: z.number().int().min(1).max(5_242_880),
  })
  .refine(
    (input) => Boolean(input.accountId) !== Boolean(input.newAccountLabel),
    "Choose exactly one account"
  )

export async function POST(request: NextRequest) {
  let userId: string
  try {
    userId = await requireUserId()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return apiError("unauthorized", "로그인이 필요합니다.", 401)
    }
    return apiError("internal_error", "요청을 처리할 수 없습니다.", 500)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("validation_error", "요청 형식이 올바르지 않습니다.", 400)
  }

  const parsed = initUploadSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("validation_error", "업로드 정보를 확인해주세요.", 400)
  }

  try {
    const result = await initStatementUpload(userId, parsed.data, {
      supabase: createServiceRoleClient(),
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof StatementUploadError) {
      return apiError(error.code, error.message, error.httpStatus)
    }
    return apiError("internal_error", "업로드를 시작할 수 없습니다.", 500)
  }
}
