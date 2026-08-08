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
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore!.set(name, value, options)
      })
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
