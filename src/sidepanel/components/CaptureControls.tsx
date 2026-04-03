import { useState } from 'react'
import type { CaptureMode } from '@shared/messages'
import { Button } from '@/components/ui/button'

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
      <div className="flex gap-1">
        {modes.map(({ mode: m, label, icon }) => (
          <Button
            key={m}
            variant={mode === m ? 'default' : 'tonal'}
            size="sm"
            onClick={() => handleModeChange(m)}
            title={label}
            className="flex-1 text-xs"
          >
            {m === 'select' ? label : icon}
          </Button>
        ))}
      </div>
      <Button variant="destructive" size="full" onClick={onStop}>
        Stop Capture
      </Button>
    </div>
  )
}
