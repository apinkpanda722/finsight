import type { ReactNode } from "react"

import { Label } from "@/components/ui/label"

type AuthShellProps = {
  children: ReactNode
}

type FormFieldProps = {
  children: ReactNode
  error?: string
  id: string
  label: string
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-[var(--color-surface-soft)]">
      <div className="px-6 py-6 sm:px-8">
        <span className="font-heading text-lg font-semibold text-foreground">
          finsight
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-8">
        <section className="w-full max-w-[420px] rounded-[24px] border border-border bg-card p-9 sm:p-10">
          {children}
        </section>
      </div>
    </main>
  )
}

export function FormField({ children, error, id, label }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-semibold text-[var(--color-body)]"
      >
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
