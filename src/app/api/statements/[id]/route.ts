import { NextResponse, type NextRequest } from "next/server"

import { requireUserId, UnauthorizedError } from "@/lib/api/auth"
import { apiError } from "@/lib/api/response"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  deleteOwnedStatement,
  getStatementStatus,
  StatementUploadError,
} from "@/services/statementUploadService"

type RouteContext = { params: Promise<{ id: string }> }

async function authenticatedUserId(): Promise<
  | { userId: string; response?: never }
  | { userId?: never; response: NextResponse }
> {
  try {
    return { userId: await requireUserId() }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        response: apiError("unauthorized", "로그인이 필요합니다.", 401),
      }
    }
    return {
      response: apiError("internal_error", "요청을 처리할 수 없습니다.", 500),
    }
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await authenticatedUserId()
  if (auth.response) return auth.response
  const { id } = await context.params

  try {
    const result = await getStatementStatus(auth.userId, id, {
      supabase: createServiceRoleClient(),
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof StatementUploadError) {
      return apiError(error.code, error.message, error.httpStatus)
    }
    return apiError("internal_error", "명세서를 확인할 수 없습니다.", 500)
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await authenticatedUserId()
  if (auth.response) return auth.response
  const { id } = await context.params

  try {
    const deleted = await deleteOwnedStatement(auth.userId, id, {
      supabase: createServiceRoleClient(),
    })
    if (!deleted) {
      return apiError("not_found", "명세서를 찾을 수 없습니다.", 404)
    }
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (error instanceof StatementUploadError) {
      return apiError(error.code, error.message, error.httpStatus)
    }
    return apiError("internal_error", "명세서를 삭제할 수 없습니다.", 500)
  }
}
