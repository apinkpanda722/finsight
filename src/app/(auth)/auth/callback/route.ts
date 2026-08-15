import { NextResponse, type NextRequest } from "next/server"

import { isSafeReturnPath } from "@/lib/auth/return-path"
import { captureServerException } from "@/lib/posthog/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const next = request.nextUrl.searchParams.get("next")

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", request.url)
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    await captureServerException(error, "auth-callback", {
      route: "auth/callback",
    })
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", request.url)
    )
  }

  const destination = next && isSafeReturnPath(next) ? next : "/dashboard"
  return NextResponse.redirect(new URL(destination, request.url))
}
