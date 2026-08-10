import { NextResponse } from "next/server"

import { requireUserId, UnauthorizedError } from "@/lib/api/auth"
import { apiError } from "@/lib/api/response"
import { createClient } from "@/lib/supabase/server"
import { getMonthKey } from "@/services/dashboardInsightService"
import {
  generateCategoryReportPdf,
  ReportAccessError,
} from "@/services/reportService"

export async function GET() {
  try {
    const userId = await requireUserId()
    const supabase = await createClient()
    const buffer = await generateCategoryReportPdf(userId, { supabase })
    const currentMonth = getMonthKey()

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="finsight-report-${currentMonth}.pdf"`,
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return apiError("unauthorized", "로그인이 필요합니다.", 401)
    }
    if (error instanceof ReportAccessError) {
      return apiError(
        "forbidden",
        "Pro 사용자만 이용할 수 있는 기능입니다.",
        403
      )
    }
    return apiError("internal_error", "리포트를 생성할 수 없습니다.", 500)
  }
}
