import { useState, useEffect } from 'react'
import type { CaptureSession } from '@shared/types'
import { ScreenshotThumbnail } from './ScreenshotThumbnail'

interface LiveFeedbackProps {
  session: CaptureSession | null
  isListening: boolean
  interimTranscript: string
  transcript: string
  captureStartedAt: number
}

export function LiveFeedback({ session, isListening, interimTranscript, transcript, captureStartedAt }: LiveFeedbackProps) {
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
    <div className="live-feedback">
      <div className="recording-indicator">
        <span className="recording-dot" /> Recording {timer}
      </div>

      {session?.selectedElement && (
        <div className="selected-element">
          <strong>Selected:</strong> {session.selectedElement.selector}
          {session.selectedElement.reactComponent && (
            <div className="component-name">
              Component: &lt;{session.selectedElement.reactComponent.name}&gt;
            </div>
          )}
        </div>
      )}

      {session && session.annotations.length > 0 && (
        <div className="annotations-list">
          <strong>Annotations:</strong> {session.annotations.length}
          {session.annotations.map((ann, i) => (
            <div key={i} className="annotation-item">
              {ann.type === 'circle' ? '\u25CB' : ann.type === 'arrow' ? '\u2192' : ann.type === 'freehand' ? '\u270E' : '\u25A1'} {ann.nearestElement || 'element'}
            </div>
          ))}
        </div>
      )}

      {session && session.screenshots.length > 0 && (
        <div className="screenshots-list" style={{ marginBottom: 10 }}>
          <strong>Screenshots:</strong> {session.screenshots.length}
          {session.screenshots.map((ss, i) => (
            <ScreenshotThumbnail key={i} screenshot={ss} size="small" />
          ))}
        </div>
      )}

      <div className="transcript-live">
        <strong>Transcript{isListening ? ' (live)' : ''}:</strong>
        <div className="transcript-text">
          {transcript}
          {interimTranscript && <span className="interim">{interimTranscript}</span>}
          {!transcript && !interimTranscript && (
            <span className="placeholder">Speak to add voice context...</span>
          )}
        </div>
      </div>
    </div>
  )
}
