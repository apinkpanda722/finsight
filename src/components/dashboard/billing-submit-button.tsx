"use client"

import { Loader2 } from "lucide-react"
import posthog from "posthog-js"
import { useState } from "react"

import { Button } from "@/components/ui/button"

type BillingSubmitButtonProps = {
  action: string
  label: string
  pendingLabel: string
  variant?: "default" | "outline"
  className?: string
  openInNewTab?: boolean
}

export function BillingSubmitButton({
  action,
  label,
  pendingLabel,
  variant,
  className,
  openInNewTab = false,
}: BillingSubmitButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleSubmit() {
    posthog.capture(
      action === "/api/checkout"
        ? "billing_checkout_started"
        : "billing_portal_opened"
    )
    setIsSubmitting(true)
    // target="_blank" 폼은 현재 페이지를 떠나지 않으므로, 언마운트 대신
    // 새 탭이 열릴 시간만 준 뒤 버튼을 다시 눌러진 상태에서 풀어준다.
    if (openInNewTab) {
      setTimeout(() => setIsSubmitting(false), 1_000)
    }
  }

  return (
    <form
      method="POST"
      action={action}
      target={openInNewTab ? "_blank" : undefined}
      className="mt-6"
      onSubmit={handleSubmit}
    >
      <Button
        type="submit"
        variant={variant}
        disabled={isSubmitting}
        className={className}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">{pendingLabel}</span>
          </>
        ) : (
          label
        )}
      </Button>
    </form>
  )
}
