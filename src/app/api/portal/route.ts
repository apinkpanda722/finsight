import { NextResponse, type NextRequest } from "next/server"

import {
  assertSameOrigin,
  requireUserId,
  SameOriginError,
  UnauthorizedError,
} from "@/lib/api/auth"
import { createPolarClient } from "@/lib/polar/client"
import { createClient } from "@/lib/supabase/server"
import {
  getOwnedPolarCustomerId,
  NoSubscriptionError,
} from "@/services/subscriptionService"

export async function POST(request: NextRequest) {
  let userId: string

  try {
    assertSameOrigin(request)
    userId = await requireUserId()
  } catch (error) {
    if (error instanceof SameOriginError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
    throw error
  }

  const supabase = await createClient()

  try {
    const customerId = await getOwnedPolarCustomerId(userId, { supabase })
    const polar = createPolarClient()
    const session = await polar.customerSessions.create({ customerId })

    return NextResponse.redirect(session.customerPortalUrl, 303)
  } catch (error) {
    if (error instanceof NoSubscriptionError) {
      return NextResponse.json(
        { error: "no_subscription" },
        { status: 409 }
      )
    }
    throw error
  }
}
