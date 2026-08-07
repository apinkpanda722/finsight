import { Badge } from "@/components/ui/badge"

export type Plan = "free" | "pro"

type PlanBadgeProps = {
  plan: Plan
}

export function PlanBadge({ plan }: PlanBadgeProps) {
  const isPro = plan === "pro"

  return (
    <Badge
      variant={isPro ? "default" : "secondary"}
      className="h-6 px-3 text-xs font-semibold tracking-[0.02em]"
    >
      {isPro ? "Pro" : "Free"}
    </Badge>
  )
}
