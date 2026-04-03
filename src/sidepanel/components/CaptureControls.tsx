import { useState } from 'react'
import type { CaptureMode } from '@shared/messages'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CaptureControlsProps {
  isCapturing: boolean
  onStart: () => void
  onStop: () => void
  onModeChange: (mode: CaptureMode) => void
}

const modes: { mode: CaptureMode; label: string; icon: string }[] = [
  { mode: 'select', label: 'Select', icon: 'Select' },
  { mode: 'circle', label: 'Circle', icon: '\u25CB' },
  { mode: 'arrow', label: 'Arrow', icon: '\u2192' },
  { mode: 'freehand', label: 'Freehand', icon: '\u270E' },
  { mode: 'rectangle', label: 'Rectangle', icon: '\u25A1' },
]

export function CaptureControls({ isCapturing, onStart, onStop, onModeChange }: CaptureControlsProps) {
  const [mode, setMode] = useState<CaptureMode>('select')

  const handleModeChange = (newMode: CaptureMode) => {
    setMode(newMode)
    onModeChange(newMode)
  }

  if (!isCapturing) {
    return (
      <Button size="full" onClick={onStart}>
        Start Capture
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-[5px] bg-surface-variant/50 rounded-xl p-[3px]">
        {modes.map(({ mode: m, label, icon }) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            title={label}
            className={cn(
              "flex-1 py-[6px] text-center text-[10px] font-medium rounded-[9px] transition-all cursor-pointer border-none",
              mode === m
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-transparent text-muted hover:text-on-surface-variant"
            )}
          >
            {m === 'select' ? label : icon}
          </button>
        ))}
      </div>
      <Button variant="destructive" size="full" onClick={onStop}>
        Stop Capture
      </Button>
    </div>
  )
}
