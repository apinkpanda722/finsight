import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ReportDownloadButton } from "./report-download-button"

const fetchMock = vi.fn()
const createObjectURLMock = vi.fn(() => "blob:finsight-report")
const revokeObjectURLMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURLMock,
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURLMock,
  })
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
})

describe("ReportDownloadButton", () => {
  it("shows the Pro upgrade CTA for Free users", () => {
    render(<ReportDownloadButton plan="free" />)

    expect(screen.getByText("PDF 리포트는 Pro 전용입니다")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Pro로 업그레이드" })).toHaveAttribute(
      "href",
      "/settings/billing"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("requests and downloads the category report for Pro users", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(
        new Blob(["pdf"], { type: "application/pdf" })
      ),
    } as Partial<Response>)
    render(<ReportDownloadButton plan="pro" />)

    fireEvent.click(screen.getByRole("button", { name: "PDF 리포트 다운로드" }))

    expect(screen.getByRole("button", { name: "리포트 생성 중" })).toBeDisabled()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/reports/category-pdf")
    })
    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalledOnce()
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:finsight-report")
    })
  })

  it.each([
    [403, "Pro 사용자만 이용할 수 있는 기능입니다."],
    [500, "리포트를 생성할 수 없습니다."],
  ])("shows the API error message for a %s response", async (status, message) => {
    fetchMock.mockResolvedValue({
      ok: false,
      status,
      json: vi.fn().mockResolvedValue({ error: "request_failed", message }),
    } as Partial<Response>)
    render(<ReportDownloadButton plan="pro" />)

    fireEvent.click(screen.getByRole("button", { name: "PDF 리포트 다운로드" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(message)
  })
})
