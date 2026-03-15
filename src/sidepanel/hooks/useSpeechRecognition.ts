import { useState, useEffect, useCallback, useRef } from 'react'
import type { VoiceSegment } from '@shared/types'

interface UseSpeechRecognitionReturn {
  isAvailable: boolean
  isListening: boolean
  transcript: string
  interimTranscript: string
  segments: VoiceSegment[]
  error: string | null
  start: (captureStartedAt: number) => void
  stop: () => void
}

// Speech recognition runs in an offscreen document because Chrome extension
// sidepanels cannot trigger microphone permission prompts.
// The initial mic permission must be granted from a visible extension page
// (mic-permission.html) because offscreen documents also can't show prompts.
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [segments, setSegments] = useState<VoiceSegment[]>([])
  const [error, setError] = useState<string | null>(null)
  const pendingStartRef = useRef<number | null>(null)

  // Listen for messages from the offscreen document and mic-permission page
  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'OFFSCREEN_SPEECH_STARTED') {
        setIsListening(true)
      } else if (message.type === 'OFFSCREEN_SPEECH_RESULT') {
        if (message.segments && message.segments.length > 0) {
          setSegments(prev => {
            const updated = [...prev, ...message.segments]
            setTranscript(updated.map((s: VoiceSegment) => s.text).join(' '))
            return updated
          })
        }
        if (message.interim !== undefined) {
          setInterimTranscript(message.interim)
        }
      } else if (message.type === 'OFFSCREEN_SPEECH_ERROR') {
        setError(message.error)
        setIsListening(false)
      } else if (message.type === 'MIC_PERMISSION_GRANTED') {
        // Permission was just granted via the visible page — start speech if pending
        if (pendingStartRef.current !== null) {
          startOffscreen(pendingStartRef.current)
          pendingStartRef.current = null
        }
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  async function startOffscreen(captureStartedAt: number) {
    try {
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('offscreen.html'),
        reasons: [chrome.offscreen.Reason.USER_MEDIA],
        justification: 'Voice transcription via Web Speech API requires microphone access',
      })
    } catch {
      // Document may already exist
    }

    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_SPEECH_START',
      captureStartedAt,
    })
  }

  const start = useCallback(async (captureStartedAt: number) => {
    setTranscript('')
    setInterimTranscript('')
    setSegments([])
    setError(null)

    // Check if microphone permission is already granted
    try {
      const permStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      if (permStatus.state === 'granted') {
        startOffscreen(captureStartedAt)
        return
      }
    } catch {
      // permissions.query may not be available — try offscreen directly
      startOffscreen(captureStartedAt)
      return
    }

    // Mic not yet granted — open the permission page in a new tab.
    // Must use a visible extension page because offscreen/sidepanel can't show prompts.
    pendingStartRef.current = captureStartedAt
    window.open(chrome.runtime.getURL('mic-permission.html'))
  }, [])

  const stop = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_SPEECH_STOP' })
    setIsListening(false)
    setInterimTranscript('')
    pendingStartRef.current = null
  }, [])

  return { isAvailable: true, isListening, transcript, interimTranscript, segments, error, start, stop }
}
