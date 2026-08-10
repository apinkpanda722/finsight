import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BillingSubmitButton } from "./billing-submit-button"

describe("BillingSubmitButton", () => {
  it("shows the label and is enabled before any click", () => {
    render(
      <BillingSubmitButton
        action="/api/portal"
        label="구독 관리"
        pendingLabel="이동 중"
      />
    )

    const button = screen.getByRole("button", { name: "구독 관리" })
    expect(button).not.toBeDisabled()
  })

  it("disables itself and shows a spinner on submit, without blocking the native form submission", async () => {
    const user = userEvent.setup()
    render(
      <BillingSubmitButton
        action="/api/portal"
        label="구독 관리"
        pendingLabel="이동 중"
      />
    )

    const button = screen.getByRole("button", { name: "구독 관리" })
    const form = button.closest("form")
    expect(form).not.toBeNull()

    const onSubmit = vi.fn((event: Event) => event.preventDefault())
    form?.addEventListener("submit", onSubmit)

    await user.click(button)

    expect(onSubmit).toHaveBeenCalledTimes(1)

    const pendingButton = screen.getByRole("button", { name: "이동 중" })
    expect(pendingButton).toBeDisabled()
    expect(pendingButton.querySelector("svg.animate-spin")).not.toBeNull()
    expect(screen.queryByText("구독 관리")).not.toBeInTheDocument()
  })

  it("renders a POST form with the given action so the browser can navigate to Polar", () => {
    render(
      <BillingSubmitButton
        action="/api/checkout"
        label="Pro로 업그레이드"
        pendingLabel="이동 중"
      />
    )

    const button = screen.getByRole("button", { name: "Pro로 업그레이드" })
    expect(button).toHaveAttribute("type", "submit")
    expect(button.closest("form")).toHaveAttribute("action", "/api/checkout")
    expect(button.closest("form")).toHaveAttribute("method", "POST")
  })

  it("does not target a new tab by default", () => {
    render(
      <BillingSubmitButton
        action="/api/checkout"
        label="Pro로 업그레이드"
        pendingLabel="이동 중"
      />
    )

    const button = screen.getByRole("button", { name: "Pro로 업그레이드" })
    expect(button.closest("form")).not.toHaveAttribute("target")
  })

  describe("openInNewTab", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("submits the form in a new tab so the current page (with its polling) stays put", () => {
      render(
        <BillingSubmitButton
          action="/api/portal"
          label="구독 관리"
          pendingLabel="이동 중"
          openInNewTab
        />
      )

      const button = screen.getByRole("button", { name: "구독 관리" })
      expect(button.closest("form")).toHaveAttribute("target", "_blank")
    })

    it("re-enables the button after submit since the current page never navigates away", () => {
      vi.useFakeTimers()
      render(
        <BillingSubmitButton
          action="/api/portal"
          label="구독 관리"
          pendingLabel="이동 중"
          openInNewTab
        />
      )

      const button = screen.getByRole("button", { name: "구독 관리" })
      const form = button.closest("form")
      form?.addEventListener("submit", (event) => event.preventDefault())

      fireEvent.click(button)
      expect(screen.getByRole("button", { name: "이동 중" })).toBeDisabled()

      act(() => {
        vi.advanceTimersByTime(1_000)
      })

      expect(
        screen.getByRole("button", { name: "구독 관리" })
      ).not.toBeDisabled()
    })
  })
})
