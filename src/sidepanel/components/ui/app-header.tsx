interface AppHeaderProps {
  title?: string
  subtitle?: string
}

export function AppHeader({ title = 'PointDev', subtitle }: AppHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-on-primary text-xs font-bold">
        P
      </div>
      <div>
        <div className="text-[15px] font-semibold text-on-surface">{title}</div>
        {subtitle && <div className="text-[10px] text-muted">{subtitle}</div>}
      </div>
    </div>
  )
}
