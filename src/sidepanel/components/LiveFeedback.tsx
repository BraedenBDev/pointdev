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
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex items-center gap-1.5 font-medium text-sm">
        <span className="w-2 h-2 bg-error rounded-full animate-pulse-dot" />
        Recording {timer}
      </div>

      {session?.selectedElement && (
        <div className="p-2 bg-surface-variant rounded-md text-xs">
          <strong>Selected:</strong> {session.selectedElement.selector}
          {session.selectedElement.reactComponent && (
            <div className="text-primary text-[11px]">
              Component: &lt;{session.selectedElement.reactComponent.name}&gt;
            </div>
          )}
        </div>
      )}

      {session && session.annotations.length > 0 && (
        <div className="p-2 bg-surface-variant rounded-md text-xs">
          <strong>Annotations:</strong> {session.annotations.length}
          {session.annotations.map((ann, i) => (
            <div key={i} className="pl-3 text-muted">
              {annotationIcon(ann.type)} {ann.nearestElement || 'element'}
            </div>
          ))}
        </div>
      )}

      {session && session.screenshots.length > 0 && (
        <div className="mb-2">
          <strong className="text-xs">Screenshots:</strong> {session.screenshots.length}
          {session.screenshots.map((ss, i) => (
            <ScreenshotThumbnail key={i} screenshot={ss} size="small" />
          ))}
        </div>
      )}

      <div className="p-2 bg-surface-variant rounded-md text-xs">
        <strong>Transcript (live):</strong>
        <div className="mt-1">
          {session?.voiceRecording?.segments.map(s => s.text).join(' ')}
          {!session?.voiceRecording?.segments.length && (
            <span className="text-muted italic">Speak to add voice context...</span>
          )}
        </div>
      </div>
    </div>
  )
}
