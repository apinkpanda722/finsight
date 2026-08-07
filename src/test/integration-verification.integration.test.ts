// @vitest-environment node

import Anthropic from "@anthropic-ai/sdk"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"
import { afterEach, describe, expect, it } from "vitest"
import { loadEnv } from "vite"

import {
  acquireProcessingLease,
  parseStatement,
} from "@/services/statementParserService"
import {
  completeStatementUpload,
  deleteOwnedStatement,
} from "@/services/statementUploadService"
import { handlePolarWebhookEvent } from "@/services/subscriptionService"
import type { Database, Json } from "@/types/supabase"

const env = loadEnv("development", process.cwd(), "")
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
const serviceRole = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const cleanupUserIds = new Set<string>()
const cleanupStoragePaths = new Set<string>()

type TestUser = {
  id: string
  email: string
  password: string
}

type CreatedUpload = {
  account_id: string
  statement_id: string
  storage_path: string
}

async function createTestUser(label: string): Promise<TestUser> {
  const suffix = randomUUID()
  const email = `finsight-${label}-${suffix}@example.com`
  const password = `Finsight-${suffix}-Aa1!`
  const { data, error } = await serviceRole.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !data.user) throw error ?? new Error("Test user was not created")
  cleanupUserIds.add(data.user.id)

  return { id: data.user.id, email, password }
}

async function createUpload(
  userId: string,
  accountLabel: string,
  fileName = "integration.csv",
  declaredSize = 128
): Promise<CreatedUpload> {
  const { data, error } = await serviceRole.rpc("create_statement_upload", {
    p_user_id: userId,
    p_account_id: null as never,
    p_new_account_label: accountLabel,
    p_file_name: fileName,
    p_declared_size: declaredSize,
  })

  if (error || !data?.[0]) throw error ?? new Error("Upload was not created")
  return data[0]
}

async function uploadCsv(path: string, csv: string): Promise<void> {
  const { error } = await serviceRole.storage
    .from("statements")
    .upload(path, Buffer.from(csv), {
      contentType: "text/csv",
      upsert: true,
    })

  if (error) throw error
  cleanupStoragePaths.add(path)
}

function authenticatedClient(): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

function currentSeoulDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date())
}

function subscriptionPayload(
  userId: string,
  productId: string,
  status: string,
  modifiedAt: string
) {
  return {
    type: "subscription.updated",
    data: {
      id: `sub-${userId}`,
      productId,
      customer: {
        id: `customer-${userId}`,
        externalId: userId,
      },
      status,
      modifiedAt,
      currentPeriodEnd: "2031-01-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    },
  }
}

afterEach(async () => {
  for (const path of cleanupStoragePaths) {
    await serviceRole.storage.from("statements").remove([path])
  }
  cleanupStoragePaths.clear()

  for (const userId of cleanupUserIds) {
    await serviceRole.auth.admin.deleteUser(userId)
  }
  cleanupUserIds.clear()
})

describe.sequential("Supabase integration guarantees", () => {
  it("serializes concurrent Free account creation", async () => {
    const user = await createTestUser("concurrency")
    const call = (label: string) =>
      serviceRole.rpc("create_statement_upload", {
        p_user_id: user.id,
        p_account_id: null as never,
        p_new_account_label: label,
        p_file_name: `${label}.csv`,
        p_declared_size: 128,
      })

    const results = await Promise.all([call("Concurrent A"), call("Concurrent B")])
    const succeeded = results.filter((result) => result.error === null)
    const failed = results.filter((result) => result.error !== null)

    expect(succeeded).toHaveLength(1)
    expect(succeeded[0].data).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect(failed[0].error?.message).toContain("upgrade_required")

    const { count, error } = await serviceRole
      .from("accounts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    expect(error).toBeNull()
    expect(count).toBe(1)
  })

  it("retains upload usage after deleting a statement", async () => {
    const user = await createTestUser("quota")
    const upload = await createUpload(user.id, "Quota account")
    await uploadCsv(upload.storage_path, "x")

    const before = await serviceRole
      .from("upload_usage")
      .select("id, statement_id")
      .eq("user_id", user.id)
    if (before.error) throw before.error

    await expect(
      deleteOwnedStatement(user.id, upload.statement_id, {
        supabase: serviceRole,
      })
    ).resolves.toBe(true)

    const after = await serviceRole
      .from("upload_usage")
      .select("id, statement_id")
      .eq("user_id", user.id)
    if (after.error) throw after.error

    expect(before.data).toHaveLength(1)
    expect(after.data).toHaveLength(1)
    expect(after.data[0].id).toBe(before.data[0].id)
    expect(after.data[0].statement_id).toBeNull()
  })

  it("keeps the newest Polar snapshot when a stale event reaches PostgREST", async () => {
    const user = await createTestUser("webhook")
    const productId = `product-${randomUUID()}`

    await handlePolarWebhookEvent(
      subscriptionPayload(
        user.id,
        productId,
        "active",
        "2030-08-07T12:00:00.000Z"
      ),
      { supabase: serviceRole, proProductId: productId }
    )
    await handlePolarWebhookEvent(
      subscriptionPayload(
        user.id,
        productId,
        "canceled",
        "2030-08-07T11:00:00.000Z"
      ),
      { supabase: serviceRole, proProductId: productId }
    )

    const { data, error } = await serviceRole
      .from("profiles")
      .select("plan, subscription_status, polar_modified_at")
      .eq("id", user.id)
      .single()

    expect(error).toBeNull()
    expect(data).toEqual({
      plan: "pro",
      subscription_status: "active",
      polar_modified_at: "2030-08-07T12:00:00+00:00",
    })
  })

  it("hides locked Free history from direct anon-key queries", async () => {
    const user = await createTestUser("rls")
    const csv = [
      "date,description,amount",
      "2000-01-01,Old transaction,-1000",
      `${currentSeoulDate()},Current transaction,-2000`,
    ].join("\n")
    const upload = await createUpload(
      user.id,
      "RLS account",
      "rls.csv",
      Buffer.byteLength(csv)
    )
    await uploadCsv(upload.storage_path, csv)
    await completeStatementUpload(user.id, upload.statement_id, {
      supabase: serviceRole,
    })
    await acquireProcessingLease(upload.statement_id, serviceRole)

    const transactions = [
      {
        row_index: 0,
        transaction_date: "2000-01-01",
        description: "Old transaction",
        amount: -1000,
        category: "other",
      },
      {
        row_index: 1,
        transaction_date: currentSeoulDate(),
        description: "Current transaction",
        amount: -2000,
        category: "other",
      },
    ]
    const finalized = await serviceRole.rpc("finalize_statement", {
      p_user_id: user.id,
      p_statement_id: upload.statement_id,
      p_transactions: transactions as Json,
    })
    if (finalized.error) throw finalized.error
    expect(finalized.data).toBe(true)

    const anon = authenticatedClient()
    const unauthenticated = await anon
      .from("transactions")
      .select("row_index")
      .eq("statement_id", upload.statement_id)
    expect(unauthenticated.error).toBeNull()
    expect(unauthenticated.data).toEqual([])

    const { error: signInError } = await anon.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    })
    if (signInError) throw signInError

    const authenticated = await anon
      .from("transactions")
      .select("row_index, transaction_date")
      .eq("statement_id", upload.statement_id)
      .order("row_index")

    expect(authenticated.error).toBeNull()
    expect(authenticated.data).toEqual([
      { row_index: 1, transaction_date: currentSeoulDate() },
    ])
  })

  it("rejects cross-user composite foreign keys with service role", async () => {
    const owner = await createTestUser("fk-owner")
    const other = await createTestUser("fk-other")
    const upload = await createUpload(owner.id, "Owner account")

    const mismatchedStatement = await serviceRole
      .from("uploaded_statements")
      .insert({
        user_id: other.id,
        account_id: upload.account_id,
        file_name: "cross-user.csv",
        declared_file_size_bytes: 128,
        storage_path: `${other.id}/${randomUUID()}`,
      })

    expect(mismatchedStatement.error?.code).toBe("23503")
    expect(mismatchedStatement.error?.message).toContain(
      "uploaded_statements_user_id_account_id_fkey"
    )

    const mismatchedTransaction = await serviceRole.from("transactions").insert({
      user_id: other.id,
      statement_id: upload.statement_id,
      row_index: 0,
      transaction_date: currentSeoulDate(),
      description: "Cross-user transaction",
      amount: -1000,
      category: "other",
    })

    expect(mismatchedTransaction.error?.code).toBe("23503")
    expect(mismatchedTransaction.error?.message).toContain(
      "transactions_user_id_statement_id_fkey"
    )
  })
})

describe("live Anthropic smoke", () => {
  it.runIf(process.env.RUN_LIVE_ANTHROPIC_SMOKE === "1")(
    "processes a five-row statement through the real API once",
    { timeout: 300_000 },
    async () => {
      const user = await createTestUser("anthropic-smoke")
      const csv = [
        "거래일자,거래내용,출금액,입금액",
        "2026-08-01,동네 식당,12000,",
        "2026-08-02,지하철,1500,",
        "2026-08-03,온라인 쇼핑,34000,",
        "2026-08-04,월급,,3000000",
        "2026-08-05,전기 요금,42000,",
      ].join("\n")
      const upload = await createUpload(
        user.id,
        "Anthropic smoke",
        "anthropic-smoke.csv",
        Buffer.byteLength(csv)
      )
      await uploadCsv(upload.storage_path, csv)
      await completeStatementUpload(user.id, upload.statement_id, {
        supabase: serviceRole,
      })

      const usage = { calls: 0, inputTokens: 0, outputTokens: 0 }
      const startedAt = performance.now()
      await parseStatement(upload.statement_id, {
        supabase: serviceRole,
        anthropic: new Anthropic({
          apiKey: env.ANTHROPIC_API_KEY,
          maxRetries: 0,
        }),
        onAnthropicUsage: (current) => {
          usage.calls += 1
          usage.inputTokens += current.inputTokens
          usage.outputTokens += current.outputTokens
        },
      })
      const elapsedMs = Math.round(performance.now() - startedAt)

      const { data, error } = await serviceRole
        .from("uploaded_statements")
        .select("status, parsed_transaction_count, failure_code")
        .eq("id", upload.statement_id)
        .single()

      console.info(
        `[live-anthropic-smoke] statementId=${upload.statement_id} userId=${user.id} calls=${usage.calls} inputTokens=${usage.inputTokens} outputTokens=${usage.outputTokens} elapsedMs=${elapsedMs}`
      )
      expect(error).toBeNull()
      expect(data).toEqual({
        status: "completed",
        parsed_transaction_count: 5,
        failure_code: null,
      })
      expect(usage.calls).toBe(2)
      expect(usage.inputTokens).toBeGreaterThan(0)
      expect(usage.outputTokens).toBeGreaterThan(0)
    }
  )
})
