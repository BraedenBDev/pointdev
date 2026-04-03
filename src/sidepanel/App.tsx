import { useRef, useEffect, useState } from 'react'
import { useCaptureSession } from './hooks/useCaptureSession'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useWhisperRecognition } from './hooks/useWhisperRecognition'
import { usePermissionStatus } from './hooks/usePermissionStatus'
import { IdleView } from './components/IdleView'
import { CaptureControls } from './components/CaptureControls'
import { LiveFeedback } from './components/LiveFeedback'
import { OutputView } from './components/OutputView'
import { Button } from '@/components/ui/button'

type SpeechEngine = 'web-speech' | 'whisper'

export function App() {
  const { state, session, error, startCapture, stopCapture, setMode, reset, setVoiceSignal } = useCaptureSession()
  const [engine, setEngine] = useState<SpeechEngine>('web-speech')
  const webSpeech = useSpeechRecognition()
  const whisper = useWhisperRecognition()
  const speech = engine === 'whisper' ? whisper : webSpeech
  const { permissions, canCapture, micGranted, requestMicPermission } = usePermissionStatus()
  const captureStartRef = useRef(0)

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
      setVoiceSignal(true, newSegment.text)
      return
    }

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

  // Complete state
  if (state === 'complete' && session) {
    const hasContent = session.selectedElement || session.annotations.length > 0 ||
      (session.voiceRecording && session.voiceRecording.segments.length > 0)
    if (!hasContent) {
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-on-primary text-xs font-bold">P</div>
            <div className="text-[15px] font-semibold text-on-surface">PointDev</div>
          </div>
          <div className="p-3 bg-error-container text-on-error-container rounded-md text-sm">
            No context captured. Try selecting an element or recording your voice.
          </div>
          <Button size="full" onClick={reset}>Try Again</Button>
        </div>
      )
    }
    return <OutputView session={session} onBack={reset} />
  }

  // Idle state
  if (state === 'idle') {
    return (
      <IdleView
        engine={engine}
        onEngineChange={setEngine}
        permissions={permissions}
        canCapture={canCapture}
        micGranted={micGranted}
        onStart={handleStart}
        onRequestMic={requestMicPermission}
      />
    )
  }

  // Preparing + Capturing states
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-on-primary text-xs font-bold">P</div>
        <div className="text-[15px] font-semibold text-on-surface">PointDev</div>
      </div>

      {state === 'error' && error && (
        <div className="p-3 bg-error-container text-on-error-container rounded-md text-sm">
          {error}
        </div>
      )}

      {state === 'preparing' && (
        <div className="text-muted text-center py-5">Preparing capture...</div>
      )}

      {speech.error && (
        <div className="p-3 bg-error-container text-on-error-container rounded-md text-sm">
          {speech.error}
        </div>
      )}

      <CaptureControls
        isCapturing={state === 'capturing'}
        onStart={handleStart}
        onStop={handleStop}
        onModeChange={setMode}
      />

      {state === 'capturing' && engine === 'whisper' && whisper.modelState === 'downloading' && (
        <div className="text-[11px] text-muted mb-2">
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
    </div>
  )
}
