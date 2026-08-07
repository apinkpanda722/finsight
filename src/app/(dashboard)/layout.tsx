import Link from "next/link"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { PlanBadge, type Plan } from "@/components/dashboard/plan-badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

const navigation = [
  { href: "/dashboard", label: "개요" },
  { href: "/uploads", label: "명세서 관리" },
  { href: "/settings/billing", label: "요금제" },
]

export async function signOutAction() {
  "use server"

  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims) {
    redirect("/login?returnTo=%2Fdashboard")
    return null
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", data.claims.sub)
    .maybeSingle()
  const plan: Plan = profile?.plan === "pro" ? "pro" : "free"

  return (
    <div className="flex min-h-screen bg-[var(--color-surface-soft)]">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-background px-4 py-6">
        <div className="flex items-center gap-2 px-2 pb-6">
          <Link
            href="/dashboard"
            className="font-heading text-lg font-semibold tracking-[-0.02em] text-primary"
          >
            finsight
          </Link>
          <PlanBadge plan={plan} />
        </div>

        <nav aria-label="대시보드 메뉴" className="flex flex-col gap-1">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-[var(--color-surface-strong)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form action={signOutAction} className="mt-auto">
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start px-3 text-muted-foreground hover:text-foreground"
          >
            로그아웃
          </Button>
        </form>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
