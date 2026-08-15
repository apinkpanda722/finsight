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

import RootLayout, { metadata } from "./layout"

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

    expect(layout.props.lang).toBe("ko")
    expect(layout.props.className).toContain("inter-font")
    expect(layout.props.className).toContain("jetbrains-mono-font")
    expect(layout.props.children.props.className).toBe("antialiased")
  })

  it("uses Finsight metadata with the differentiator SEO title", () => {
    expect(metadata.title).toEqual({
      default: "계좌 연동 없이 CSV로 쓰는 가계부 | Finsight",
      template: "%s | Finsight",
    })
    expect(metadata.description).toContain("CSV")
    expect(metadata.description).toContain("계좌 연동")
  })

  it("sets an absolute metadataBase for resolving Open Graph URLs", () => {
    expect(metadata.metadataBase).toBeInstanceOf(URL)
  })

  it("exposes matching Open Graph and Twitter card metadata", () => {
    expect(metadata.openGraph).toMatchObject({
      title: "계좌 연동 없이 CSV로 쓰는 가계부 | Finsight",
      siteName: "Finsight",
      locale: "ko_KR",
      type: "website",
    })
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "계좌 연동 없이 CSV로 쓰는 가계부 | Finsight",
    })
  })

  it("allows indexing by default at the root", () => {
    expect(metadata.robots).toMatchObject({ index: true, follow: true })
  })
})
