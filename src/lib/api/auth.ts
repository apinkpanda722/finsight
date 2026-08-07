import type { NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

export class SameOriginError extends Error {
  constructor() {
    super("Request origin does not match the application origin")
    this.name = "SameOriginError"
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required")
    this.name = "UnauthorizedError"
  }
}

export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin")
  const requestHost = request.headers.get("host") ?? request.nextUrl.host

  if (!origin) {
    throw new SameOriginError()
  }

  try {
    const originUrl = new URL(origin)
    if (
      originUrl.protocol !== request.nextUrl.protocol ||
      originUrl.host !== requestHost
    ) {
      throw new SameOriginError()
    }
  } catch (error) {
    if (error instanceof SameOriginError) throw error
    throw new SameOriginError()
  }
}

export async function requireUserId(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  if (typeof userId !== "string" || userId.length === 0) {
    throw new UnauthorizedError()
  }

  return userId
}
