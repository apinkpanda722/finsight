"use client"

import Link from "next/link"
import posthog from "posthog-js"
import { useState } from "react"

import type { Plan } from "@/components/dashboard/plan-badge"
import { Button } from "@/components/ui/button"

type ReportDownloadButtonProps = {
  plan: Plan
}

const DOWNLOAD_ERROR_MESSAGE =
  "리포트를 다운로드할 수 없습니다. 잠시 후 다시 시도해주세요."

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json()

    if (
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
    ) {
      return payload.message
    }
  } catch {
    // Fall through to the user-safe fallback for malformed error responses.
  }

  return DOWNLOAD_ERROR_MESSAGE
}

export function ReportDownloadButton({ plan }: ReportDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function downloadReport() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/reports/category-pdf")

      if (!response.ok) {
        setError(await getErrorMessage(response))
        return
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")

      try {
        link.href = objectUrl
        link.download = "finsight-report.pdf"
        document.body.append(link)
        link.click()
        posthog.capture("report_downloaded", {
          report_type: "category_pdf",
        })
      } finally {
        link.remove()
        URL.revokeObjectURL(objectUrl)
      }
    } catch {
      setError(DOWNLOAD_ERROR_MESSAGE)
    } finally {
      setIsLoading(false)
    }
  }

  if (plan === "free") {
    return (
      <aside className="mb-6 flex flex-col justify-between gap-4 rounded-[var(--radius-xl)] border border-border bg-background p-5 sm:flex-row sm:items-center">
        <div>
          <p className="font-heading text-base font-semibold">
            PDF 리포트는 Pro 전용입니다
          </p>
          <p className="mt-1 text-sm text-[var(--color-body)]">
            Pro로 업그레이드하면 카테고리별 지출과 월별 추이를 PDF로 저장할 수 있습니다.
          </p>
        </div>
        <Button asChild className="h-10 px-5">
          <Link href="/settings/billing">Pro로 업그레이드</Link>
        </Button>
      </aside>
    )
  }

  return (
    <div className="mb-6 flex flex-col items-end gap-3">
      <Button
        type="button"
        className="h-10 px-5"
        disabled={isLoading}
        onClick={downloadReport}
      >
        {isLoading ? "리포트 생성 중" : "PDF 리포트 다운로드"}
      </Button>
      {error ? (
        <p
          role="alert"
          className="w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm text-[var(--color-body)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
