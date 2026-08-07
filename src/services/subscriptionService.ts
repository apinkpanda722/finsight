import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import type { Database } from "@/types/supabase"

type SubscriptionServiceDeps = {
  supabase: SupabaseClient<Database>
}

type PolarWebhookDeps = SubscriptionServiceDeps & {
  proProductId: string
}

type UnknownRecord = Record<string, unknown>

const userIdSchema = z.string().uuid()
const proStatuses = new Set(["trialing", "active", "past_due"])

export class NoSubscriptionError extends Error {
  readonly code = "no_subscription"

  constructor() {
    super("No Polar subscription exists for this user")
    this.name = "NoSubscriptionError"
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null
}

function toIsoString(value: unknown, fieldName: string): string {
  const date = value instanceof Date ? value : new Date(String(value))

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Polar subscription ${fieldName}`)
  }

  return date.toISOString()
}

export async function getOwnedPolarCustomerId(
  userId: string,
  deps: SubscriptionServiceDeps
): Promise<string> {
  const { data, error } = await deps.supabase
    .from("profiles")
    .select("polar_customer_id")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw error
  if (!data?.polar_customer_id) throw new NoSubscriptionError()

  return data.polar_customer_id
}

export async function handlePolarWebhookEvent(
  payload: unknown,
  deps: PolarWebhookDeps
): Promise<void> {
  if (
    !isRecord(payload) ||
    typeof payload.type !== "string" ||
    !payload.type.startsWith("subscription.") ||
    !isRecord(payload.data) ||
    typeof payload.data.productId !== "string"
  ) {
    return
  }

  const subscription = payload.data
  if (subscription.productId !== deps.proProductId) return

  const customer = subscription.customer
  const externalId = isRecord(customer) ? customer.externalId : null
  const parsedUserId = userIdSchema.safeParse(externalId)

  if (!parsedUserId.success) {
    throw new Error("Invalid Polar external customer id")
  }

  if (
    typeof subscription.id !== "string" ||
    typeof subscription.status !== "string" ||
    !isRecord(customer) ||
    typeof customer.id !== "string" ||
    subscription.modifiedAt == null
  ) {
    throw new Error("Invalid Polar subscription data")
  }

  const modifiedAt = toIsoString(subscription.modifiedAt, "modifiedAt")
  const currentPeriodEnd =
    subscription.currentPeriodEnd == null
      ? null
      : toIsoString(subscription.currentPeriodEnd, "currentPeriodEnd")

  const { error } = await deps.supabase
    .from("profiles")
    .update({
      plan: proStatuses.has(subscription.status) ? "pro" : "free",
      subscription_status: subscription.status,
      polar_subscription_id: subscription.id,
      polar_customer_id: customer.id,
      polar_product_id: subscription.productId,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancelAtPeriodEnd === true,
      polar_modified_at: modifiedAt,
    })
    .eq("id", parsedUserId.data)
    .or(`polar_modified_at.is.null,polar_modified_at.lt.${modifiedAt}`)

  if (error) throw error
}
