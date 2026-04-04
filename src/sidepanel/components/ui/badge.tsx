import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-surface-variant text-on-surface-variant",
        voice: "bg-purple-100 text-purple-700",
        "frame-diff": "bg-blue-100 text-blue-700",
        dwell: "bg-amber-100 text-amber-700",
        annotation: "bg-emerald-100 text-emerald-700",
        multi: "bg-pink-100 text-pink-700",
        "status-ok": "bg-transparent text-primary font-medium",
        "status-error": "bg-transparent text-error font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
