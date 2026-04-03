import { useState, useEffect } from 'react'
import type { CaptureSession } from '@shared/types'
import { ScreenshotThumbnail } from './ScreenshotThumbnail'

interface LiveFeedbackProps {
  session: CaptureSession | null
  captureStartedAt: number
}

function annotationIcon(type: string): string {
  switch (type) {
    case 'circle': return '\u25CB'
    case 'arrow': return '\u2192'
    case 'freehand': return '\u270E'
    default: return '\u25A1'
  }
}

export function LiveFeedback({ session, captureStartedAt }: LiveFeedbackProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!captureStartedAt) return
    const interval = setInterval(() => {
      setElapsed(Date.now() - captureStartedAt)
    }, 1000)
    return () => clearInterval(interval)
  }, [captureStartedAt])

  const minutes = Math.floor(elapsed / 60000)
  const seconds = Math.floor((elapsed % 60000) / 1000)
  const timer = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-2">
      {/* Timer */}
      <div className="bg-surface-variant/50 rounded-xl px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-on-surface-variant">Duration</span>
        <span className="text-sm font-semibold text-on-surface font-mono">{timer}</span>
      </div>

      {session?.selectedElement && (
        <div className="bg-surface-variant/50 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Selected</div>
          <div className="text-xs text-on-surface-variant font-mono">{session.selectedElement.selector}</div>
          {session.selectedElement.reactComponent && (
            <div className="text-primary text-[11px] mt-0.5">
              &lt;{session.selectedElement.reactComponent.name}&gt;
            </div>
          )}
        </div>
      )}

      {session && session.annotations.length > 0 && (
        <div className="bg-surface-variant/50 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
            Annotations ({session.annotations.length})
          </div>
          {session.annotations.map((ann, i) => (
            <div key={i} className="text-xs text-on-surface-variant pl-2 py-0.5">
              {annotationIcon(ann.type)} {ann.nearestElement || 'element'}
            </div>
          ))}
        </div>
      )}

      {session && session.screenshots.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5 px-1">
            Screenshots ({session.screenshots.length})
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {session.screenshots.map((ss, i) => (
              <ScreenshotThumbnail key={i} screenshot={ss} size="small" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
