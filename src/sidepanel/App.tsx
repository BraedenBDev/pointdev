import { useRef, useEffect } from 'react'
import { useCaptureSession } from './hooks/useCaptureSession'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { CaptureControls } from './components/CaptureControls'
import { LiveFeedback } from './components/LiveFeedback'
import { OutputView } from './components/OutputView'
import './styles.css'

export function App() {
  const { state, session, error, startCapture, stopCapture, setMode, reset } = useCaptureSession()
  const speech = useSpeechRecognition()
  const captureStartRef = useRef(0)

  // Send transcript updates incrementally as segments arrive
  const lastSegmentCountRef = useRef(0)
  useEffect(() => {
    if (state !== 'capturing') return
    if (speech.segments.length > lastSegmentCountRef.current) {
      const newSegment = speech.segments[speech.segments.length - 1]
      chrome.runtime.sendMessage({
        type: 'TRANSCRIPT_UPDATE',
        data: { transcript: speech.transcript, segment: newSegment },
      })
      lastSegmentCountRef.current = speech.segments.length
    }
  }, [speech.segments, speech.transcript, state])

  const handleStart = async () => {
    captureStartRef.current = Date.now()
    lastSegmentCountRef.current = 0
    await startCapture()
    if (speech.isAvailable) {
      speech.start(captureStartRef.current)
    }
  }

  const handleStop = async () => {
    speech.stop()
    await stopCapture()
  }

  if (state === 'complete' && session) {
    // Empty capture detection
    const hasContent = session.selectedElement || session.annotations.length > 0 ||
      (session.voiceRecording && session.voiceRecording.segments.length > 0)
    if (!hasContent) {
      return (
        <div>
          <div className="header">PointDev</div>
          <div className="error-message">
            No context captured. Try selecting an element or recording your voice.
          </div>
          <button className="btn-primary" onClick={reset}>Try Again</button>
        </div>
      )
    }
    return <OutputView session={session} onBack={reset} />
  }

  return (
    <div>
      <div className="header">PointDev</div>

      {state === 'error' && error && (
        <div className="error-message">{error}</div>
      )}

      {state === 'preparing' && (
        <div className="preparing">Preparing capture...</div>
      )}

      {speech.micPermission === 'needs-setup' && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn-primary" onClick={speech.requestMicPermission}>
            Setup Microphone
          </button>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
            Required for voice narration. One-time setup.
          </div>
        </div>
      )}

      {speech.error && (
        <div className="error-message">{speech.error}</div>
      )}

      <CaptureControls
        isCapturing={state === 'capturing'}
        onStart={handleStart}
        onStop={handleStop}
        onModeChange={setMode}
      />

      {state === 'capturing' && (
        <LiveFeedback
          session={session}
          isListening={speech.isListening}
          interimTranscript={speech.interimTranscript}
          transcript={speech.transcript}
          captureStartedAt={captureStartRef.current}
        />
      )}

      {state === 'idle' && (
        <div style={{ marginTop: 16, color: 'var(--muted)', fontSize: 12 }}>
          Click Start Capture, then talk, draw, and click on the page to capture structured context.
        </div>
      )}
    </div>
  )
}
