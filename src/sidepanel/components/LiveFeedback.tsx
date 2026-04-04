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
    <div className="flex flex-col gap-3">
      {/* Timer */}
      <div className="bg-surface-variant/50 rounded-xl px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm text-on-surface-variant">Duration</span>
        <span className="text-base font-semibold text-on-surface font-mono">{timer}</span>
      </div>

      {session?.selectedElement && (
        <div className="bg-surface-variant/50 rounded-xl p-4">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Selected</div>
          <div className="text-sm text-on-surface-variant font-mono break-all">{session.selectedElement.selector}</div>
          {session.selectedElement.reactComponent && (
            <div className="text-primary text-xs mt-1">
              &lt;{session.selectedElement.reactComponent.name}&gt;
            </div>
          )}
        </div>
      )}

      {session && session.annotations.length > 0 && (
        <div className="bg-surface-variant/50 rounded-xl p-4">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
            Annotations ({session.annotations.length})
          </div>
          {session.annotations.map((ann, i) => (
            <div key={i} className="text-sm text-on-surface-variant pl-2 py-0.5">
              {annotationIcon(ann.type)} {ann.nearestElement || 'element'}
            </div>
          ))}
        </div>
      )}

      {session && session.screenshots.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Screenshots ({session.screenshots.length})
          </div>
          <div className="grid grid-cols-2 gap-3">
            {session.screenshots.map((ss, i) => (
              <ScreenshotThumbnail key={i} screenshot={ss} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
