import type { CookieMethodsServer } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

const protectedPathPattern =
  /^\/(?:dashboard|uploads|billing)(?:\/|$)|^\/settings(?:\/|$)/

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const cookieAdapter: CookieMethodsServer = {
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet, headers) => {
      cookiesToSet.forEach(({ name, value }) => {
        request.cookies.set(name, value)
      })

      supabaseResponse = NextResponse.next({ request })
      cookiesToSet.forEach(({ name, value, options }) => {
        supabaseResponse.cookies.set(name, value, options)
      })
      Object.entries(headers).forEach(([name, value]) => {
        supabaseResponse.headers.set(name, value)
      })
    },
  }

  const supabase = await createClient(cookieAdapter)
  const { data } = await supabase.auth.getClaims()

  if (protectedPathPattern.test(request.nextUrl.pathname) && !data?.claims) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = ""
    loginUrl.searchParams.set("returnTo", request.nextUrl.pathname)

    const redirectResponse = NextResponse.redirect(loginUrl)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })
    for (const header of ["cache-control", "expires", "pragma"]) {
      const value = supabaseResponse.headers.get(header)
      if (value) redirectResponse.headers.set(header, value)
    }

    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
