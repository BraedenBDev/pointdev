import { cn } from "@/lib/utils"

export interface SegmentedOption {
  value: string
  label: string
}

export interface SegmentedButtonProps {
  options: SegmentedOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function SegmentedButton({ options, value, onChange, className }: SegmentedButtonProps) {
  return (
    <div className={cn("flex bg-surface-variant rounded-md p-0.5", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 py-2 text-center text-[11px] font-medium rounded-lg transition-all cursor-pointer border-none",
            value === option.value
              ? "bg-surface text-on-surface shadow-sm"
              : "bg-transparent text-muted hover:text-on-surface-variant"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
