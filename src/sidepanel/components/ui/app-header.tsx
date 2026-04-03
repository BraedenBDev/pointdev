interface AppHeaderProps {
  title?: string
  subtitle?: string
}

export function AppHeader({ title = 'PointDev', subtitle }: AppHeaderProps) {
  return (
    <div className="flex items-center gap-2.5 pb-0.5">
      <div className="w-8 h-8 bg-primary rounded-[10px] flex items-center justify-center text-on-primary text-sm font-bold shadow-sm">
        P
      </div>
      <div>
        <div className="text-[15px] font-semibold text-on-surface leading-tight">{title}</div>
        {subtitle && <div className="text-[10px] text-muted leading-tight mt-0.5">{subtitle}</div>}
      </div>
    </div>
  )
}
