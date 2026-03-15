import { useState, useEffect, useRef, useCallback } from 'react'
import type { CaptureSession } from '@shared/types'
import type { CaptureMode, Message } from '@shared/messages'

type CaptureState = 'idle' | 'preparing' | 'capturing' | 'complete' | 'error'

export function useCaptureSession() {
  const [state, setState] = useState<CaptureState>('idle')
  const [session, setSession] = useState<CaptureSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const portRef = useRef<chrome.runtime.Port | null>(null)

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
    } else if (response?.type === 'SESSION_UPDATED') {
      setSession(response.session)
      setState('capturing')
    }
  }, [])

  const stopCapture = useCallback(async () => {
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

  return { state, session, error, startCapture, stopCapture, setMode, reset }
}
