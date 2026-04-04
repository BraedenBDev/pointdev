import { cn } from "@/lib/utils"

export interface PermissionRowProps {
  name: string
  status: "ok" | "error"
  label: string
  action?: string
  onAction?: () => void
}

export function PermissionRow({ name, status, label, action, onAction }: PermissionRowProps) {
  const isError = status === "error"

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors",
        isError ? "bg-error-container border-error/20" : "bg-surface border-outline/60"
      )}
    >
      <div
        className={cn(
          "w-[6px] h-[6px] rounded-full shrink-0",
          isError ? "bg-error" : "bg-primary"
        )}
      />
      <span
        className={cn(
          "text-xs flex-1",
          isError ? "text-on-error-container" : "text-on-surface-variant"
        )}
      >
        {name}
      </span>
      {action && onAction ? (
        <button
          onClick={onAction}
          className="text-xs font-medium text-error underline cursor-pointer bg-transparent border-none p-0"
        >
          {action} →
        </button>
      ) : (
        <span
          className={cn(
            "text-xs font-medium",
            isError ? "text-error" : "text-primary"
          )}
        >
          {label}
        </span>
      )}
    </div>
  )
}
