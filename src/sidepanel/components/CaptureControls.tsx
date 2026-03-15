import { useState } from 'react'
import type { CaptureMode } from '@shared/messages'

interface CaptureControlsProps {
  isCapturing: boolean
  onStart: () => void
  onStop: () => void
  onModeChange: (mode: CaptureMode) => void
}

export function CaptureControls({ isCapturing, onStart, onStop, onModeChange }: CaptureControlsProps) {
  const [mode, setMode] = useState<CaptureMode>('select')

  const handleModeChange = (newMode: CaptureMode) => {
    setMode(newMode)
    onModeChange(newMode)
  }

  if (!isCapturing) {
    return (
      <button className="btn-primary" onClick={onStart}>
        Start Capture
      </button>
    )
  }

  return (
    <div className="capture-controls">
      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'select' ? 'active' : ''}`}
          onClick={() => handleModeChange('select')}
          title="Select element"
        >
          Select
        </button>
        <button
          className={`mode-btn ${mode === 'circle' ? 'active' : ''}`}
          onClick={() => handleModeChange('circle')}
          title="Draw circle"
        >
          &#9675;
        </button>
        <button
          className={`mode-btn ${mode === 'arrow' ? 'active' : ''}`}
          onClick={() => handleModeChange('arrow')}
          title="Draw arrow"
        >
          &#8594;
        </button>
      </div>
      <button className="btn-stop" onClick={onStop}>
        Stop Capture
      </button>
    </div>
  )
}
