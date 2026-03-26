import { useRef, useEffect, useState } from 'react'
import { useCaptureSession } from './hooks/useCaptureSession'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useWhisperRecognition } from './hooks/useWhisperRecognition'
import { CaptureControls } from './components/CaptureControls'
import { LiveFeedback } from './components/LiveFeedback'
import { OutputView } from './components/OutputView'
import './styles.css'

type SpeechEngine = 'web-speech' | 'whisper'

function toggleStyle(active: boolean): React.CSSProperties {
  return {
    padding: '3px 10px', fontSize: 11, borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', cursor: 'pointer',
    background: active ? 'var(--accent)' : 'var(--code-bg)',
    color: active ? '#fff' : 'var(--fg)',
  }
}

export function App() {
  const { state, session, error, startCapture, stopCapture, setMode, reset, setVoiceSignal } = useCaptureSession()
  const [engine, setEngine] = useState<SpeechEngine>('web-speech')
  const webSpeech = useSpeechRecognition()
  const whisper = useWhisperRecognition()
  const speech = engine === 'whisper' ? whisper : webSpeech
  const captureStartRef = useRef(0)

  // Send transcript updates and feed voice signal to screenshot intelligence
  const lastSegmentCountRef = useRef(0)
  useEffect(() => {
    if (state !== 'capturing') return

    // New final segment → send to service worker + signal intelligence
    if (speech.segments.length > lastSegmentCountRef.current) {
      const newSegment = speech.segments[speech.segments.length - 1]
      chrome.runtime.sendMessage({
        type: 'TRANSCRIPT_UPDATE',
        data: { transcript: speech.transcript, segment: newSegment },
      })
      lastSegmentCountRef.current = speech.segments.length
      setVoiceSignal(true, newSegment.text)
      return
    }

    // Interim transcript → voice-active signal while user is speaking
    setVoiceSignal(speech.interimTranscript.length > 0, speech.interimTranscript)
  }, [speech.segments, speech.transcript, speech.interimTranscript, state, setVoiceSignal])

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

      {state === 'capturing' && engine === 'whisper' && whisper.modelState === 'downloading' && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
          Downloading speech model... {Math.round(whisper.downloadProgress * 100)}%
        </div>
      )}

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
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Speech engine:</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setEngine('web-speech')} style={toggleStyle(engine === 'web-speech')}>
              Fast (Google)
            </button>
            <button onClick={() => setEngine('whisper')} style={toggleStyle(engine === 'whisper')}>
              Private (On-device)
            </button>
          </div>
        </div>
      )}

      {state === 'idle' && (
        <div style={{ marginTop: 16, color: 'var(--muted)', fontSize: 12 }}>
          Click Start Capture, then talk, draw, and click on the page to capture structured context.
        </div>
      )}
    </div>
  )
}
