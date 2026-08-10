"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { usePendingUpload } from "@/components/dashboard/pending-upload-context"

export function EmptyDashboardCard() {
  const router = useRouter()
  const { setPendingFile } = usePendingUpload()
  const [isDragging, setIsDragging] = useState(false)

  return (
    <main className="flex min-h-screen items-center justify-center p-6 sm:p-10">
      <Card
        data-testid="empty-dashboard-dropzone"
        data-dragging={isDragging ? "true" : undefined}
        className={`w-full max-w-[640px] text-center shadow-none transition-colors ${
          isDragging
            ? "border-primary bg-[var(--color-surface-soft)]"
            : "border-border"
        }`}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          const droppedFile = event.dataTransfer.files?.[0]
          if (!droppedFile) return
          setPendingFile(droppedFile)
          router.push("/uploads?upload=1")
        }}
      >
        <CardContent className="flex flex-col items-center p-10 sm:p-14">
          <span className="flex size-14 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-sm font-semibold">
            파일
          </span>
          <h1 className="mt-6 font-heading text-3xl font-normal tracking-[-0.02em]">
            아직 업로드한 명세서가 없어요.
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            첫 CSV/PDF를 업로드하거나 파일을 끌어다 놓아보세요
          </p>
          <Button asChild className="mt-8 h-12 px-6 text-base">
            <Link href="/uploads?upload=1">CSV/PDF 업로드하기</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
