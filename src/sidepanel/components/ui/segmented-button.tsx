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
    <div className={cn("flex bg-surface-variant rounded-xl p-[3px]", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 py-2 text-center text-xs font-medium rounded-[9px] transition-all cursor-pointer border-none",
            value === option.value
              ? "bg-surface text-on-surface shadow-sm"
              : "bg-transparent text-on-surface-variant hover:text-on-surface"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
