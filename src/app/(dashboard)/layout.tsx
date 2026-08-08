import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { createClient } from "@/lib/supabase/server"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims) {
    redirect("/login?returnTo=%2Fdashboard")
  }

  return children
}
