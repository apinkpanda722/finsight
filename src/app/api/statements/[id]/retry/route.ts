import { after, NextResponse, type NextRequest } from "next/server"

import { requireUserId, UnauthorizedError } from "@/lib/api/auth"
import { apiError } from "@/lib/api/response"
import { createAnthropicClient } from "@/lib/anthropic/client"
import { captureServerException } from "@/lib/posthog/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { parseStatement } from "@/services/statementParserService"
import {
  retryStatement,
  StatementUploadError,
} from "@/services/statementUploadService"

export const maxDuration = 300

type RouteContext = { params: Promise<{ id: string }> }

async function processStatement(statementId: string) {
  await parseStatement(statementId, {
    supabase: createServiceRoleClient(),
    anthropic: createAnthropicClient(),
  })
}

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
    await retryStatement(userId, id, { supabase: createServiceRoleClient() })
    after(() => processStatement(id))
    return NextResponse.json(
      { statementId: id, status: "pending" },
      { status: 202 }
    )
  } catch (error) {
    if (error instanceof StatementUploadError) {
      return apiError(error.code, error.message, error.httpStatus)
    }
    await captureServerException(error, userId, {
      route: "statements/[id]/retry",
    })
    return apiError("internal_error", "분석을 재시도할 수 없습니다.", 500)
  }
}
