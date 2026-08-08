import type { ReactElement, ReactNode } from "react"

import { describe, expect, it, vi } from "vitest"

const fontMocks = vi.hoisted(() => ({
  inter: vi.fn(() => ({ variable: "inter-font" })),
  jetBrainsMono: vi.fn(() => ({ variable: "jetbrains-mono-font" })),
}))

vi.mock("next/font/google", () => ({
  Inter: fontMocks.inter,
  JetBrains_Mono: fontMocks.jetBrainsMono,
}))
vi.mock("./globals.css", () => ({}))

import RootLayout from "./layout"

describe("RootLayout", () => {
  it("loads the finsight font variables", () => {
    expect(fontMocks.inter).toHaveBeenCalledWith({
      subsets: ["latin"],
      variable: "--font-body",
    })
    expect(fontMocks.jetBrainsMono).toHaveBeenCalledWith({
      subsets: ["latin"],
      variable: "--font-mono",
    })
  })

  it("exposes both font variables to the application", () => {
    const layout = RootLayout({ children: <main>Finsight</main> }) as ReactElement<{
      children: ReactElement<{ children: ReactNode; className: string }>
      className: string
      lang: string
    }>

    expect(layout.props.lang).toBe("en")
    expect(layout.props.className).toContain("inter-font")
    expect(layout.props.className).toContain("jetbrains-mono-font")
    expect(layout.props.children.props.className).toBe("antialiased")
  })
})
