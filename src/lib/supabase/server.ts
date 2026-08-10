import { createServerClient, type CookieMethodsServer } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

import { getServerEnv, publicEnv } from "@/lib/env"
import type { Database } from "@/types/supabase"

export async function createClient(cookieMethods?: CookieMethodsServer) {
  const cookieStore = cookieMethods ? null : await cookies()
  const adapter: CookieMethodsServer = cookieMethods ?? {
    getAll: () => cookieStore!.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore!.set(name, value, options)
        })
      } catch {
        // Server Component에서 호출된 경우 무시 — 미들웨어가 세션을 갱신한다.
      }
    },
  }

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: adapter }
  )
}

export function createServiceRoleClient() {
  const env = getServerEnv()

  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
