import { NextResponse } from "next/server"

import type { ApiErrorCode } from "@/types/domain"

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number
): NextResponse<{ error: ApiErrorCode; message: string }> {
  return NextResponse.json({ error: code, message }, { status })
}
