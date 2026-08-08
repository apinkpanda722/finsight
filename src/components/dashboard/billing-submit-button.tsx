"use client"

import { Loader2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

type BillingSubmitButtonProps = {
  action: string
  label: string
  pendingLabel: string
  variant?: "default" | "outline"
  className?: string
}

export function BillingSubmitButton({
  action,
  label,
  pendingLabel,
  variant,
  className,
}: BillingSubmitButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <form
      method="POST"
      action={action}
      className="mt-6"
      onSubmit={() => setIsSubmitting(true)}
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
