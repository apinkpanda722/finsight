import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 sm:p-10">
      <Card className="w-full max-w-[640px] border-border text-center shadow-none">
        <CardContent className="flex flex-col items-center p-10 sm:p-14">
          <span className="flex size-14 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-sm font-semibold">
            CSV
          </span>
          <h1 className="mt-6 font-heading text-3xl font-normal tracking-[-0.02em]">
            아직 업로드한 명세서가 없어요.
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            첫 CSV를 업로드해보세요
          </p>
          <Button asChild className="mt-8 h-12 px-6 text-base">
            <Link href="/uploads">CSV 업로드하기</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
