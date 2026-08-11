import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas"

// pdfjs-dist expects browser canvas globals. Its own dynamic `require("@napi-rs/canvas")`
// isn't picked up by Next.js's server output file tracing, so we import it statically
// here (before pdfjs-dist is imported) and polyfill the globals ourselves.
if (typeof globalThis.DOMMatrix === "undefined") {
  // @ts-expect-error Node.js runtime polyfill
  globalThis.DOMMatrix = DOMMatrix
}
if (typeof globalThis.Path2D === "undefined") {
  // @ts-expect-error Node.js runtime polyfill
  globalThis.Path2D = Path2D
}
if (typeof globalThis.ImageData === "undefined") {
  // @ts-expect-error Node.js runtime polyfill
  globalThis.ImageData = ImageData
}
