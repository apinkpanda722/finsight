import iconv from "iconv-lite"

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])

function decodeUtf8(buf: Buffer): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(buf)
}

export function decodeCsvBuffer(
  buf: Buffer
): { text: string; encoding: "utf-8" | "cp949" } {
  if (buf.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)) {
    return {
      text: decodeUtf8(buf.subarray(UTF8_BOM.length)),
      encoding: "utf-8",
    }
  }

  try {
    return { text: decodeUtf8(buf), encoding: "utf-8" }
  } catch {
    const text = iconv.decode(buf, "cp949")

    if (text.includes("\uFFFD")) {
      throw new Error("Unsupported CSV encoding")
    }

    return { text, encoding: "cp949" }
  }
}
