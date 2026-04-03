import { useRef, useEffect, useState } from 'react'
import { useCaptureSession } from './hooks/useCaptureSession'
import { usePermissionStatus } from './hooks/usePermissionStatus'
import { AppHeader } from '@/components/ui/app-header'
import { IdleView } from './components/IdleView'
import { CaptureControls } from './components/CaptureControls'
import { LiveFeedback } from './components/LiveFeedback'
import { OutputView } from './components/OutputView'
import { Button } from '@/components/ui/button'

type SpeechEngine = 'web-speech' | 'whisper'

export function App() {
  const { state, session, error, startCapture, stopCapture, setMode, reset } = useCaptureSession()
  const [engine, setEngine] = useState<SpeechEngine>('web-speech')
  const { permissions, canCapture, micGranted, requestMicPermission } = usePermissionStatus()
  const captureStartRef = useRef(0)

  // Persist engine preference to storage (offscreen doc reads it)
  useEffect(() => {
    chrome.storage.local.set({ pointdev_voice_engine: engine })
  }, [engine])

  // Load initial engine preference from storage
  useEffect(() => {
    chrome.storage.local.get('pointdev_voice_engine').then(({ pointdev_voice_engine }) => {
      if (pointdev_voice_engine) setEngine(pointdev_voice_engine)
    }).catch(() => {})
  }, [])

  const handleStart = async () => {
    captureStartRef.current = Date.now()
    await startCapture()
    // Close sidepanel — floating card takes over during capture
    window.close()
  }

  const handleStop = async () => {
    await stopCapture()
  }

  // Complete state
  if (state === 'complete' && session) {
    const hasContent = session.selectedElement || session.annotations.length > 0 ||
      (session.voiceRecording && session.voiceRecording.segments.length > 0)
    if (!hasContent) {
      return (
        <div className="flex flex-col gap-3">
          <AppHeader />
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

      <CaptureControls
        isCapturing={state === 'capturing'}
        onStart={handleStart}
        onStop={handleStop}
        onModeChange={setMode}
      />

      {state === 'capturing' && (
        <LiveFeedback
          session={session}
          captureStartedAt={captureStartRef.current}
        />
      )}
    </div>
  )
}
