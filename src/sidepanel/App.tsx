import { useRef, useEffect, useState } from 'react'
import { useCaptureSession } from './hooks/useCaptureSession'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useWhisperRecognition } from './hooks/useWhisperRecognition'
import { usePermissionStatus } from './hooks/usePermissionStatus'
import { AppHeader } from '@/components/ui/app-header'
import { IdleView } from './components/IdleView'
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

  // Persist engine preference
  useEffect(() => {
    chrome.storage.local.set({ pointdev_voice_engine: engine })
  }, [engine])

  // Load initial engine preference
  useEffect(() => {
    chrome.storage.local.get('pointdev_voice_engine').then(({ pointdev_voice_engine }) => {
      if (pointdev_voice_engine) setEngine(pointdev_voice_engine)
    }).catch(() => {})
  }, [])

  // Send transcript updates and feed voice signal to screenshot intelligence
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

  // Stop voice when capture ends (e.g. floating card stop button)
  useEffect(() => {
    if (state === 'complete' || state === 'idle') {
      speech.stop()
    }
  }, [state, speech.stop])

  const handleStart = async () => {
    captureStartRef.current = Date.now()
    lastSegmentCountRef.current = 0
    const ok = await startCapture()
    if (ok && speech.isAvailable) {
      speech.start(captureStartRef.current)
    }
  }

  // Complete state
  if (state === 'complete' && session) {
    const hasContent = session.selectedElement || session.annotations.length > 0 ||
      (session.voiceRecording && session.voiceRecording.segments.length > 0)
    if (!hasContent) {
      return (
        <div className="flex flex-col gap-4">
          <AppHeader />
          <div className="p-4 bg-error-container text-on-error-container rounded-xl text-sm">
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

  // Preparing + Capturing states — sidepanel is passive display only
  // All controls (mode buttons, stop) are on the floating card in the page
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <AppHeader />
        {state === 'capturing' && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-error rounded-full animate-pulse-dot" />
            <span className="text-xs font-medium text-on-surface">Recording</span>
          </div>
        )}
      </div>

      <div className="h-px bg-outline/60" />

      {state === 'error' && error && (
        <div className="p-4 bg-error-container text-on-error-container rounded-xl text-sm">
          {error}
        </div>
      )}

      {state === 'preparing' && (
        <div className="text-muted text-center py-8 text-sm">Preparing capture...</div>
      )}

      {speech.error && (
        <div className="p-4 bg-error-container text-on-error-container rounded-xl text-sm">
          {speech.error}
        </div>
      )}

      {state === 'capturing' && engine === 'whisper' && whisper.modelState === 'downloading' && (
        <div className="bg-surface-variant/50 rounded-xl p-4">
          <div className="text-xs text-muted">
            Downloading speech model... {Math.round(whisper.downloadProgress * 100)}%
          </div>
          <div className="mt-2 h-1.5 bg-outline/40 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.round(whisper.downloadProgress * 100)}%` }} />
          </div>
        </div>
      )}

      {state === 'capturing' && (
        <div className="bg-surface-variant/50 rounded-xl p-4">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Transcript{speech.isListening ? ' (live)' : ''}
          </div>
          <div className="text-sm text-on-surface-variant leading-relaxed">
            {speech.transcript}
            {speech.interimTranscript && <span className="text-muted"> {speech.interimTranscript}</span>}
            {!speech.transcript && !speech.interimTranscript && (
              <span className="text-muted italic">Speak to add voice context...</span>
            )}
          </div>
        </div>
      )}

      {state === 'capturing' && (
        <LiveFeedback
          session={session}
          captureStartedAt={captureStartRef.current}
        />
      )}

      {state === 'capturing' && (
        <div className="text-xs text-muted text-center">
          Use the floating card on the page to control capture
        </div>
      )}
    </div>
  )
}
