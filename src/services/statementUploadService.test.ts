import { describe, expect, it, vi } from "vitest"

import {
  completeStatementUpload,
  deleteOwnedStatement,
  getStatementStatus,
  initStatementUpload,
  reissueUploadUrl,
  retryStatement,
} from "./statementUploadService"
import { buildTestPdf } from "@/test/pdf-fixture"

const USER_ID = "8a1ca0d4-0a18-4fa5-b984-0a34eb1d6271"
const STATEMENT_ID = "3a7487c0-6616-4cc6-8249-df06f8fd72da"
const STORAGE_PATH = `${USER_ID}/${STATEMENT_ID}`

function statement(overrides: Record<string, unknown> = {}) {
  return {
    id: STATEMENT_ID,
    user_id: USER_ID,
    file_name: "statement.csv",
    detected_label: null,
    declared_file_size_bytes: 100,
    file_size_bytes: null,
    row_count: null,
    parsed_transaction_count: null,
    period_start: null,
    period_end: null,
    storage_path: STORAGE_PATH,
    status: "uploading",
    failure_code: null,
    error_message: null,
    parse_attempt_count: 0,
    processing_lease_expires_at: null,
    created_at: "2026-08-07T10:00:00.000Z",
    updated_at: "2026-08-07T10:00:00.000Z",
    processed_at: null,
    ...overrides,
  }
}

function makeSupabase(options: {
  ownerResults?: Array<{ data: unknown; error: unknown }>
  rpcResult?: { data: unknown; error: unknown }
  signedResult?: { data: unknown; error: unknown }
  downloadResult?: { data: Blob | null; error: unknown }
  removeResult?: { data: unknown; error: unknown }
  updateResult?: { data?: unknown; error: unknown }
  deleteResult?: { data?: unknown; error: unknown }
} = {}) {
  const maybeSingle = vi.fn()
  for (const result of options.ownerResults ?? [
    { data: statement(), error: null },
  ]) {
    maybeSingle.mockResolvedValueOnce(result)
  }

  const ownerSecondEq = vi.fn().mockReturnValue({ maybeSingle })
  const ownerFirstEq = vi.fn().mockReturnValue({ eq: ownerSecondEq })
  const select = vi.fn().mockReturnValue({ eq: ownerFirstEq })
  const updateEq = vi
    .fn()
    .mockResolvedValue(options.updateResult ?? { error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const deleteSecondEq = vi
    .fn()
    .mockResolvedValue(options.deleteResult ?? { error: null })
  const deleteFirstEq = vi.fn().mockReturnValue({ eq: deleteSecondEq })
  const deleteRow = vi.fn().mockReturnValue({ eq: deleteFirstEq })
  const from = vi.fn().mockReturnValue({ select, update, delete: deleteRow })

  const rpc = vi.fn().mockResolvedValue(
    options.rpcResult ?? {
      data: [
        {
          statement_id: STATEMENT_ID,
          storage_path: STORAGE_PATH,
        },
      ],
      error: null,
    }
  )
  const createSignedUploadUrl = vi.fn().mockResolvedValue(
    options.signedResult ?? { data: { token: "upload-token" }, error: null }
  )
  const download = vi.fn().mockResolvedValue(
    options.downloadResult ?? {
      data: new Blob(["date,amount\n2026-08-07,12000"]),
      error: null,
    }
  )
  const remove = vi
    .fn()
    .mockResolvedValue(options.removeResult ?? { data: null, error: null })
  const storageFrom = vi.fn().mockReturnValue({
    createSignedUploadUrl,
    download,
    remove,
  })

  return {
    supabase: { from, rpc, storage: { from: storageFrom } },
    createSignedUploadUrl,
    deleteFirstEq,
    deleteRow,
    deleteSecondEq,
    download,
    from,
    maybeSingle,
    remove,
    rpc,
    select,
    storageFrom,
    update,
    updateEq,
  }
}

describe("initStatementUpload", () => {
  it("uses the quota RPC and signs only its server-generated storage path", async () => {
    const db = makeSupabase()

    await expect(
      initStatementUpload(
        USER_ID,
        {
          fileName: "original-name.csv",
          declaredSizeBytes: 100,
        },
        { supabase: db.supabase as never }
      )
    ).resolves.toEqual({
      statementId: STATEMENT_ID,
      storagePath: STORAGE_PATH,
      uploadToken: "upload-token",
      status: "uploading",
    })

    expect(db.rpc).toHaveBeenCalledWith("create_statement_upload", {
      p_user_id: USER_ID,
      p_file_name: "original-name.csv",
      p_declared_size: 100,
    })
    expect(db.createSignedUploadUrl).toHaveBeenCalledWith(STORAGE_PATH, {
      upsert: true,
    })
  })

  it.each([
    ["rate_limited", "rate_limited"],
    ["profile_not_found", "not_found"],
    ["database unavailable", "internal_error"],
  ] as const)("maps RPC error %s to %s", async (message, code) => {
    const db = makeSupabase({
      rpcResult: { data: null, error: { message } },
    })

    await expect(
      initStatementUpload(
        USER_ID,
        {
          fileName: "statement.csv",
          declaredSizeBytes: 100,
        },
        { supabase: db.supabase as never }
      )
    ).rejects.toMatchObject({ code })
  })
})

describe("reissueUploadUrl", () => {
  it("reuses the owned uploading statement without consuming quota or creating an account", async () => {
    const db = makeSupabase()

    await expect(
      reissueUploadUrl(USER_ID, STATEMENT_ID, {
        supabase: db.supabase as never,
      })
    ).resolves.toEqual({ uploadToken: "upload-token" })

    expect(db.rpc).not.toHaveBeenCalled()
    expect(db.from).toHaveBeenCalledTimes(1)
    expect(db.from).toHaveBeenCalledWith("uploaded_statements")
    expect(db.createSignedUploadUrl).toHaveBeenCalledWith(STORAGE_PATH, {
      upsert: true,
    })
  })

  it("rejects a statement that is no longer uploading", async () => {
    const db = makeSupabase({
      ownerResults: [{ data: statement({ status: "pending" }), error: null }],
    })

    await expect(
      reissueUploadUrl(USER_ID, STATEMENT_ID, {
        supabase: db.supabase as never,
      })
    ).rejects.toMatchObject({ code: "conflict" })
  })
})

describe("completeStatementUpload", () => {
  it("validates the stored bytes and persists the actual size and row count", async () => {
    const csv = "date,description,amount\n2026-08-07,Lunch,12000"
    const db = makeSupabase({
      downloadResult: { data: new Blob([csv]), error: null },
    })

    await expect(
      completeStatementUpload(USER_ID, STATEMENT_ID, {
        supabase: db.supabase as never,
      })
    ).resolves.toEqual({ statementId: STATEMENT_ID, status: "pending" })

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        file_size_bytes: Buffer.byteLength(csv),
        row_count: 1,
      })
    )
    expect(db.updateEq).toHaveBeenCalledWith("id", STATEMENT_ID)
  })

  it("returns the current state on a repeated completion without downloading again", async () => {
    const db = makeSupabase({
      ownerResults: [
        { data: statement(), error: null },
        {
          data: statement({ status: "pending", file_size_bytes: 32, row_count: 1 }),
          error: null,
        },
      ],
    })
    const deps = { supabase: db.supabase as never }

    await completeStatementUpload(USER_ID, STATEMENT_ID, deps)
    await expect(
      completeStatementUpload(USER_ID, STATEMENT_ID, deps)
    ).resolves.toEqual({ statementId: STATEMENT_ID, status: "pending" })

    expect(db.download).toHaveBeenCalledTimes(1)
    expect(db.update).toHaveBeenCalledTimes(1)
  })

  it("rejects a 2,001-row file and removes the invalid object", async () => {
    const rows = Array.from({ length: 2_001 }, (_, index) => `2026-08-07,${index}`)
    const db = makeSupabase({
      downloadResult: {
        data: new Blob([["date,amount", ...rows].join("\n")]),
        error: null,
      },
    })

    await expect(
      completeStatementUpload(USER_ID, STATEMENT_ID, {
        supabase: db.supabase as never,
      })
    ).rejects.toMatchObject({
      code: "validation_error",
    })
    expect(db.update).toHaveBeenCalledWith({
      status: "failed",
      failure_code: "invalid_csv",
      error_message: "CSV 구조를 읽을 수 없습니다.",
      updated_at: expect.any(String),
    })
    expect(db.remove).toHaveBeenCalledWith([STORAGE_PATH])
  })

  it("accepts a PDF statement and persists its row count", async () => {
    const pdf = await buildTestPdf([
      [{ text: "date", x: 50 }, { text: "amount", x: 400 }],
      [{ text: "2026-08-07", x: 50 }, { text: "12000", x: 400 }],
    ])
    const db = makeSupabase({
      downloadResult: { data: new Blob([new Uint8Array(pdf)]), error: null },
    })

    await expect(
      completeStatementUpload(USER_ID, STATEMENT_ID, {
        supabase: db.supabase as never,
      })
    ).resolves.toEqual({ statementId: STATEMENT_ID, status: "pending" })

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        file_size_bytes: pdf.byteLength,
        row_count: 1,
      })
    )
  })

  it("fails a PDF without a readable table and removes the invalid object", async () => {
    const pdf = await buildTestPdf([[{ text: "Just a title", x: 50 }]])
    const db = makeSupabase({
      downloadResult: { data: new Blob([new Uint8Array(pdf)]), error: null },
    })

    await expect(
      completeStatementUpload(USER_ID, STATEMENT_ID, {
        supabase: db.supabase as never,
      })
    ).rejects.toMatchObject({ code: "validation_error" })
    expect(db.update).toHaveBeenCalledWith({
      status: "failed",
      failure_code: "invalid_pdf",
      error_message: "PDF 표 구조를 읽을 수 없습니다.",
      updated_at: expect.any(String),
    })
    expect(db.remove).toHaveBeenCalledWith([STORAGE_PATH])
  })

  it("keeps the failed DB state authoritative when Storage cleanup rejects", async () => {
    const db = makeSupabase({
      downloadResult: { data: new Blob([Buffer.from([0x81, 0x20, 0xff])]), error: null },
    })
    db.remove.mockRejectedValueOnce(new Error("storage unavailable"))

    await expect(
      completeStatementUpload(USER_ID, STATEMENT_ID, {
        supabase: db.supabase as never,
      })
    ).rejects.toMatchObject({ code: "validation_error" })
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failure_code: "encoding_error",
      })
    )
  })
})

describe("statement reads and deletion", () => {
  it("marks failed and expired-processing statements as retryable", async () => {
    const db = makeSupabase({
      ownerResults: [
        {
          data: statement({
            status: "failed",
            detected_label: "신한카드",
            error_message: "CSV 구조를 읽을 수 없습니다.",
          }),
          error: null,
        },
      ],
    })

    await expect(
      getStatementStatus(USER_ID, STATEMENT_ID, {
        supabase: db.supabase as never,
      })
    ).resolves.toMatchObject({
      statementId: STATEMENT_ID,
      status: "failed",
      detectedLabel: "신한카드",
      retryable: true,
      errorMessage: "CSV 구조를 읽을 수 없습니다.",
    })

    const expired = makeSupabase({
      ownerResults: [
        {
          data: statement({
            status: "processing",
            processing_lease_expires_at: "2026-08-07T09:00:00.000Z",
          }),
          error: null,
        },
      ],
    })
    await expect(
      getStatementStatus(USER_ID, STATEMENT_ID, {
        supabase: expired.supabase as never,
      })
    ).resolves.toMatchObject({ retryable: true })
  })

  it("continues deleting the DB row when the Storage object is already absent", async () => {
    const db = makeSupabase({
      removeResult: {
        data: null,
        error: { statusCode: "404", message: "Object not found" },
      },
    })

    await expect(
      deleteOwnedStatement(USER_ID, STATEMENT_ID, {
        supabase: db.supabase as never,
      })
    ).resolves.toBe(true)

    expect(db.remove).toHaveBeenCalledWith([STORAGE_PATH])
    expect(db.deleteRow).toHaveBeenCalledOnce()
    expect(db.deleteFirstEq).toHaveBeenCalledWith("id", STATEMENT_ID)
    expect(db.deleteSecondEq).toHaveBeenCalledWith("user_id", USER_ID)
    expect(db.from).not.toHaveBeenCalledWith("upload_usage")
  })
})

describe("retryStatement", () => {
  function makeRetrySupabase(current: Record<string, unknown>, retried = true) {
    const ownerMaybeSingle = vi.fn().mockResolvedValue({ data: current, error: null })
    const ownerSecondEq = vi.fn().mockReturnValue({ maybeSingle: ownerMaybeSingle })
    const ownerFirstEq = vi.fn().mockReturnValue({ eq: ownerSecondEq })
    const select = vi.fn().mockReturnValue({ eq: ownerFirstEq })

    const updateMaybeSingle = vi.fn().mockResolvedValue({
      data: retried ? { id: STATEMENT_ID } : null,
      error: null,
    })
    const updateBuilder = {
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle }),
    }
    const update = vi.fn().mockReturnValue(updateBuilder)
    const from = vi
      .fn()
      .mockReturnValueOnce({ select })
      .mockReturnValueOnce({ update })

    return { supabase: { from }, update, updateBuilder }
  }

  it("moves an owned failed statement back to pending without resetting attempts", async () => {
    const db = makeRetrySupabase(
      statement({ status: "failed", parse_attempt_count: 3 })
    )

    await expect(
      retryStatement(USER_ID, STATEMENT_ID, { supabase: db.supabase as never })
    ).resolves.toBe(true)

    expect(db.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ parse_attempt_count: expect.anything() })
    )
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        processing_lease_expires_at: null,
        failure_code: null,
        error_message: null,
      })
    )
    expect(db.updateBuilder.eq).toHaveBeenCalledWith("status", "failed")
  })

  it("rejects a statement whose state is not retryable", async () => {
    const db = makeRetrySupabase(statement({ status: "completed" }))

    await expect(
      retryStatement(USER_ID, STATEMENT_ID, { supabase: db.supabase as never })
    ).rejects.toMatchObject({ code: "conflict", httpStatus: 409 })
    expect(db.update).not.toHaveBeenCalled()
  })
})
