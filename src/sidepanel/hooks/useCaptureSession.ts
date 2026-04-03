import { useState, useEffect, useRef, useCallback } from 'react'
import type { CaptureSession } from '@shared/types'
import type { CaptureMode, Message } from '@shared/messages'
import { ScreenshotIntelligence } from '../screenshot-intelligence'

type CaptureState = 'idle' | 'preparing' | 'capturing' | 'complete' | 'error'

/** Push session to bridge server. Silent fail if bridge is not running. */
function pushToBridge(session: CaptureSession): void {
  try {
    const stripped = {
      ...session,
      screenshots: session.screenshots.map(({ dataUrl, ...rest }) => rest),
    }
    const ws = new WebSocket('ws://localhost:3456')
    ws.onerror = () => ws.close()
    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ type: 'push_session', session: stripped }))
      } finally {
        ws.close()
      }
    }
  } catch {}
}

export function useCaptureSession() {
  const [state, setState] = useState<CaptureState>('idle')
  const [session, setSession] = useState<CaptureSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const portRef = useRef<chrome.runtime.Port | null>(null)
  const portIntentionalRef = useRef(false)
  const intelligenceRef = useRef<ScreenshotIntelligence | null>(null)
  const annotationCountRef = useRef(0)

  useEffect(() => {
    const listener = (message: Message) => {
      if (message.type === 'SESSION_UPDATED') {
        setSession(message.session)
        setState('capturing')

        // When a new annotation is added, trigger an annotation screenshot
        // after a short delay so the canvas overlay is visible in the capture
        // Trigger annotation screenshot when a new annotation arrives
        const annCount = message.session.annotations.length
        if (annCount > annotationCountRef.current && intelligenceRef.current) {
          annotationCountRef.current = annCount
          const lastIdx = annCount - 1
          // Delay so canvas overlay renders the annotation before capture
          setTimeout(() => {
            intelligenceRef.current?.triggerAnnotation(lastIdx)
          }, 200)
        }
      } else if (message.type === 'CAPTURE_COMPLETE') {
        setSession(message.session)
        setState('complete')
      } else if (message.type === 'CAPTURE_ERROR') {
        setError(message.error)
        setState('error')
      } else if (message.type === 'DWELL_UPDATE') {
        intelligenceRef.current?.setDwellActive(
          message.data.active,
          message.data.element,
          message.data.durationMs
        )
      } else {
        return false // Not handled — don't hold channel open
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => {
      chrome.runtime.onMessage.removeListener(listener)
      portIntentionalRef.current = true
      portRef.current?.disconnect()
      portRef.current = null
    }
  }, [])

  const startCapture = useCallback(async () => {
    setState('preparing')
    setError(null)
    annotationCountRef.current = 0

    // Establish keep-alive port
    portIntentionalRef.current = false
    portRef.current = chrome.runtime.connect({ name: 'pointdev-keepalive' })
    portRef.current.onDisconnect.addListener(() => {
      if (portIntentionalRef.current) return
      // Service worker restarted -- reconnect
      portRef.current = chrome.runtime.connect({ name: 'pointdev-keepalive' })
    })

    const response = await chrome.runtime.sendMessage({ type: 'START_CAPTURE' })
    if (response?.type === 'CAPTURE_ERROR') {
      setError(response.error)
      setState('error')
      portIntentionalRef.current = true
      portRef.current?.disconnect()
      portRef.current = null
      return
    }

    if (response?.type === 'SESSION_UPDATED') {
      setSession(response.session)
      setState('capturing')

      // Start screenshot intelligence — uses periodic captureVisibleTab
      // snapshots via service worker for frame differencing
      const intelligence = new ScreenshotIntelligence((signals) => {
        chrome.runtime.sendMessage({
          type: 'SMART_SCREENSHOT_REQUEST',
          data: signals,
        })
      })
      intelligence.start(response.session.startedAt)
      intelligenceRef.current = intelligence
    }
  }, [])

  const stopCapture = useCallback(async () => {
    // Stop intelligence before ending capture
    if (intelligenceRef.current) {
      intelligenceRef.current.stop()
      intelligenceRef.current = null
    }

    const response = await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' })
    if (response?.type === 'CAPTURE_COMPLETE') {
      setSession(response.session)
      setState('complete')
      pushToBridge(response.session)
    }
    portIntentionalRef.current = true
    portRef.current?.disconnect()
    portRef.current = null
  }, [])

  const setMode = useCallback((mode: CaptureMode) => {
    chrome.runtime.sendMessage({ type: 'SET_MODE', mode })
  }, [])

  const reset = useCallback(() => {
    portIntentionalRef.current = true
    portRef.current?.disconnect()
    portRef.current = null
    setState('idle')
    setSession(null)
    setError(null)
  }, [])

  // Expose intelligence ref so voice hook can feed signals
  const setVoiceSignal = useCallback((active: boolean, segment?: string) => {
    intelligenceRef.current?.setVoiceActive(active, segment)
  }, [])

  return { state, session, error, startCapture, stopCapture, setMode, reset, setVoiceSignal }
}
