import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const routerMocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerMocks.push }),
}))

import { EmptyDashboardCard } from "./empty-dashboard-card"
import { PendingUploadProvider, usePendingUpload } from "./pending-upload-context"

function PendingFileProbe() {
  const { takePendingFile } = usePendingUpload()
  return (
    <button type="button" onClick={() => {
      const file = takePendingFile()
      document.title = file ? file.name : "none"
    }}>
      reveal
    </button>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("EmptyDashboardCard", () => {
  it("shows the empty-upload heading, hint, and link to the uploads page", () => {
    render(<EmptyDashboardCard />)

    expect(
      screen.getByRole("heading", { name: "아직 업로드한 명세서가 없어요." })
    ).toBeInTheDocument()
    expect(
      screen.getByText("첫 CSV/PDF를 업로드하거나 파일을 끌어다 놓아보세요")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "CSV/PDF 업로드하기" })
    ).toHaveAttribute("href", "/uploads?upload=1")
  })

  it("shows a drag-active state on drag over and clears it on drag leave", () => {
    render(<EmptyDashboardCard />)
    const card = screen.getByTestId("empty-dashboard-dropzone")

    fireEvent.dragOver(card)
    expect(card).toHaveAttribute("data-dragging", "true")

    fireEvent.dragLeave(card)
    expect(card).not.toHaveAttribute("data-dragging")
  })

  it("hands a dropped file off to the uploads page via the pending-upload context, then navigates there", async () => {
    render(
      <PendingUploadProvider>
        <EmptyDashboardCard />
        <PendingFileProbe />
      </PendingUploadProvider>
    )

    const card = screen.getByTestId("empty-dashboard-dropzone")
    const file = new File(["date,amount\n2026-08-07,12000"], "dropped.csv", {
      type: "text/csv",
    })
    fireEvent.drop(card, { dataTransfer: { files: [file] } })

    expect(routerMocks.push).toHaveBeenCalledWith("/uploads?upload=1")

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "reveal" }))
    expect(document.title).toBe("dropped.csv")
  })
})
