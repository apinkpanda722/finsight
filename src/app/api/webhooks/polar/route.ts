import { Webhooks } from "@polar-sh/nextjs"

import { getServerEnv } from "@/lib/env"
import { captureServerException } from "@/lib/posthog/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { handlePolarWebhookEvent } from "@/services/subscriptionService"

const env = getServerEnv()
const supabase = createServiceRoleClient()

export const POST = Webhooks({
  webhookSecret: env.POLAR_WEBHOOK_SECRET,
  onPayload: async (payload) => {
    try {
      await handlePolarWebhookEvent(payload, {
        supabase,
        proProductId: env.POLAR_PRO_PRODUCT_ID,
      })
    } catch (error) {
      await captureServerException(error, "polar-webhook", {
        route: "webhooks/polar",
      })
      throw error
    }
  },
})
