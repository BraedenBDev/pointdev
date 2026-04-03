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
        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border",
        isError ? "bg-error-container border-error/20" : "bg-white border-outline"
      )}
    >
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          isError ? "bg-error" : "bg-primary"
        )}
      />
      <span
        className={cn(
          "text-[11px] flex-1",
          isError ? "text-on-error-container" : "text-on-surface-variant"
        )}
      >
        {name}
      </span>
      {action && onAction ? (
        <button
          onClick={onAction}
          className="text-[10px] font-medium text-error underline cursor-pointer bg-transparent border-none p-0"
        >
          {action} →
        </button>
      ) : (
        <span
          className={cn(
            "text-[10px] font-medium",
            isError ? "text-error" : "text-primary"
          )}
        >
          {label}
        </span>
      )}
    </div>
  )
}
