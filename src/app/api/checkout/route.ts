import { NextResponse, type NextRequest } from "next/server"

import {
  assertSameOrigin,
  requireUserId,
  SameOriginError,
  UnauthorizedError,
} from "@/lib/api/auth"
import { getServerEnv } from "@/lib/env"
import { createPolarClient } from "@/lib/polar/client"

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

  const env = getServerEnv()
  const polar = createPolarClient()
  const checkout = await polar.checkouts.create({
    products: [env.POLAR_PRO_PRODUCT_ID],
    externalCustomerId: userId,
    successUrl: env.SUCCESS_URL,
  })

  return NextResponse.redirect(checkout.url, 303)
}
