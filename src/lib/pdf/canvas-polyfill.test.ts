import { describe, expect, it } from "vitest"

describe("canvas-polyfill", () => {
  it("polyfills DOMMatrix, Path2D, and ImageData on globalThis for pdfjs-dist", async () => {
    await import("./canvas-polyfill")

    expect(typeof globalThis.DOMMatrix).toBe("function")
    expect(typeof globalThis.Path2D).toBe("function")
    expect(typeof globalThis.ImageData).toBe("function")
  })
})
