interface AppHeaderProps {
  title?: string
  subtitle?: string
}

export function AppHeader({ title = 'PointDev', subtitle }: AppHeaderProps) {
  return (
    <div className="flex items-center gap-2.5 pb-0.5 min-w-0">
      <div className="w-8 h-8 shrink-0 bg-primary rounded-[10px] flex items-center justify-center text-on-primary text-sm font-bold shadow-sm">
        P
      </div>
      <div className="min-w-0">
        <div className="text-base font-semibold text-on-surface leading-tight truncate">{title}</div>
        {subtitle && <div className="text-xs text-muted leading-tight mt-0.5 truncate">{subtitle}</div>}
      </div>
    </div>
  )
}
