import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import {
  PendingUploadProvider,
  usePendingUpload,
} from "./pending-upload-context"

function Probe() {
  const { setPendingFile, takePendingFile } = usePendingUpload()
  return (
    <>
      <button
        type="button"
        onClick={() =>
          setPendingFile(new File(["a"], "dropped.csv", { type: "text/csv" }))
        }
      >
        set
      </button>
      <button
        type="button"
        onClick={() => {
          const file = takePendingFile()
          document.title = file ? file.name : "none"
        }}
      >
        take
      </button>
    </>
  )
}

describe("usePendingUpload", () => {
  it("returns safe no-op defaults when used without a provider", () => {
    render(<Probe />)

    expect(() => screen.getByText("set")).not.toThrow()
  })

  it("hands off a file set via setPendingFile to a single takePendingFile call, then clears it", async () => {
    const user = userEvent.setup()
    render(
      <PendingUploadProvider>
        <Probe />
      </PendingUploadProvider>
    )

    await user.click(screen.getByRole("button", { name: "set" }))
    await user.click(screen.getByRole("button", { name: "take" }))
    expect(document.title).toBe("dropped.csv")

    document.title = ""
    await user.click(screen.getByRole("button", { name: "take" }))
    expect(document.title).toBe("none")
  })
})
