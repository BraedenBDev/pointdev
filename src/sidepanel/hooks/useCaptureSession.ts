import { useState, useEffect, useRef, useCallback } from 'react'
import type { CaptureSession } from '@shared/types'
import type { CaptureMode, Message } from '@shared/messages'
import { ScreenshotIntelligence } from '../screenshot-intelligence'

type CaptureState = 'idle' | 'preparing' | 'capturing' | 'complete' | 'error'

export function useCaptureSession() {
  const [state, setState] = useState<CaptureState>('idle')
  const [session, setSession] = useState<CaptureSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const portRef = useRef<chrome.runtime.Port | null>(null)
  const intelligenceRef = useRef<ScreenshotIntelligence | null>(null)

  useEffect(() => {
    const listener = (message: Message) => {
      if (message.type === 'SESSION_UPDATED') {
        setSession(message.session)
        setState('capturing')
      } else if (message.type === 'CAPTURE_COMPLETE') {
        setSession(message.session)
        setState('complete')
      } else if (message.type === 'CAPTURE_ERROR') {
        setError(message.error)
        setState('error')
      } else if (message.type === 'DWELL_UPDATE') {
        // Feed dwell signal to intelligence module
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
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const startCapture = useCallback(async () => {
    setState('preparing')
    setError(null)

    // Establish keep-alive port
    portRef.current = chrome.runtime.connect({ name: 'pointdev-keepalive' })
    portRef.current.onDisconnect.addListener(() => {
      // Service worker restarted -- reconnect
      portRef.current = chrome.runtime.connect({ name: 'pointdev-keepalive' })
    })

    const response = await chrome.runtime.sendMessage({ type: 'START_CAPTURE' })
    if (response?.type === 'CAPTURE_ERROR') {
      setError(response.error)
      setState('error')
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
    }
    portRef.current?.disconnect()
    portRef.current = null
  }, [])

  const setMode = useCallback((mode: CaptureMode) => {
    chrome.runtime.sendMessage({ type: 'SET_MODE', mode })
  }, [])

  const reset = useCallback(() => {
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
