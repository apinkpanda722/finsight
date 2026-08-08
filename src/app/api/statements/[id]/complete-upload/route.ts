import { NextResponse, type NextRequest } from "next/server"

import { requireUserId, UnauthorizedError } from "@/lib/api/auth"
import { apiError } from "@/lib/api/response"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  completeStatementUpload,
  StatementUploadError,
} from "@/services/statementUploadService"

export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, context: RouteContext) {
  let userId: string
  try {
    userId = await requireUserId()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return apiError("unauthorized", "로그인이 필요합니다.", 401)
    }
    return apiError("internal_error", "요청을 처리할 수 없습니다.", 500)
  }

  const { id } = await context.params

  try {
    const result = await completeStatementUpload(userId, id, {
      supabase: createServiceRoleClient(),
    })
    return NextResponse.json(result, { status: 202 })
  } catch (error) {
    if (error instanceof StatementUploadError) {
      return apiError(error.code, error.message, error.httpStatus)
    }
    return apiError("internal_error", "파일을 검증할 수 없습니다.", 500)
  }
}
