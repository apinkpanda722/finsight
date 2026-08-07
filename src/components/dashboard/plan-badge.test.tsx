import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PlanBadge } from "./plan-badge"

describe("PlanBadge", () => {
  it.each([
    ["free", "Free", "secondary"],
    ["pro", "Pro", "default"],
  ] as const)("renders the %s plan", (plan, label, variant) => {
    render(<PlanBadge plan={plan} />)

    const badge = screen.getByText(label)

    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute("data-variant", variant)
  })
})
