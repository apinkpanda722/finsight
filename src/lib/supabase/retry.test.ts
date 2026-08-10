import { describe, expect, it, vi } from "vitest"

import { withClockSkewRetry } from "./retry"

describe("withClockSkewRetry", () => {
  it("returns the result immediately when there is no error", async () => {
    const run = vi.fn().mockResolvedValue({ data: "ok", error: null })

    const result = await withClockSkewRetry(run, 0)

    expect(result).toEqual({ data: "ok", error: null })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("does not retry for errors other than PGRST303", async () => {
    const error = { code: "PGRST116", message: "no rows" }
    const run = vi.fn().mockResolvedValue({ data: null, error })

    const result = await withClockSkewRetry(run, 0)

    expect(result.error).toBe(error)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("retries when the first call fails with PGRST303 (JWT issued at future)", async () => {
    const error = { code: "PGRST303", message: "JWT issued at future" }
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error })
      .mockResolvedValueOnce({ data: "ok", error: null })

    const result = await withClockSkewRetry(run, 0)

    expect(result).toEqual({ data: "ok", error: null })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("keeps retrying while the skew persists, up to 3 attempts total", async () => {
    const error = { code: "PGRST303", message: "JWT issued at future" }
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error })
      .mockResolvedValueOnce({ data: null, error })
      .mockResolvedValueOnce({ data: "ok", error: null })

    const result = await withClockSkewRetry(run, 0)

    expect(result).toEqual({ data: "ok", error: null })
    expect(run).toHaveBeenCalledTimes(3)
  })

  it("gives up after 3 attempts if the skew never resolves", async () => {
    const error = { code: "PGRST303", message: "JWT issued at future" }
    const run = vi.fn().mockResolvedValue({ data: null, error })

    const result = await withClockSkewRetry(run, 0)

    expect(result.error).toBe(error)
    expect(run).toHaveBeenCalledTimes(3)
  })
})
