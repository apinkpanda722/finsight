import { describe, expect, it, vi } from "vitest"

import {
  completeStatementUpload,
  deleteOwnedStatement,
  getStatementStatus,
  initStatementUpload,
  reissueUploadUrl,
} from "./statementUploadService"

const USER_ID = "8a1ca0d4-0a18-4fa5-b984-0a34eb1d6271"
const ACCOUNT_ID = "02a4f23e-6ce5-4743-8858-9822cda92031"
const STATEMENT_ID = "3a7487c0-6616-4cc6-8249-df06f8fd72da"
const STORAGE_PATH = `${USER_ID}/${STATEMENT_ID}`

function statement(overrides: Record<string, unknown> = {}) {
  return {
    id: STATEMENT_ID,
    user_id: USER_ID,
    account_id: ACCOUNT_ID,
    file_name: "statement.csv",
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
          account_id: ACCOUNT_ID,
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
          accountId: ACCOUNT_ID,
          fileName: "original-name.csv",
          declaredSizeBytes: 100,
        },
        { supabase: db.supabase as never }
      )
    ).resolves.toEqual({
      statementId: STATEMENT_ID,
      accountId: ACCOUNT_ID,
      storagePath: STORAGE_PATH,
      uploadToken: "upload-token",
      status: "uploading",
    })

    expect(db.rpc).toHaveBeenCalledWith("create_statement_upload", {
      p_user_id: USER_ID,
      p_account_id: ACCOUNT_ID,
      p_new_account_label: "",
      p_file_name: "original-name.csv",
      p_declared_size: 100,
    })
    expect(db.createSignedUploadUrl).toHaveBeenCalledWith(STORAGE_PATH, {
      upsert: true,
    })
  })

  it.each([
    ["rate_limited", "rate_limited"],
    ["upgrade_required", "upgrade_required"],
    ["account_not_found", "not_found"],
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
          accountId: ACCOUNT_ID,
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
  it("returns a status response with retry disabled for this step", async () => {
    const db = makeSupabase({
      ownerResults: [
        {
          data: statement({
            status: "failed",
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
      retryable: false,
      errorMessage: "CSV 구조를 읽을 수 없습니다.",
    })
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
