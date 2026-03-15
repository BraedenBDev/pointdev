import { useState, useEffect, useCallback } from 'react'
import type { VoiceSegment } from '@shared/types'

interface UseSpeechRecognitionReturn {
  isAvailable: boolean
  isListening: boolean
  micPermission: 'unknown' | 'granted' | 'denied' | 'prompt'
  transcript: string
  interimTranscript: string
  segments: VoiceSegment[]
  error: string | null
  requestMicPermission: () => void
  start: (captureStartedAt: number) => void
  stop: () => void
}

// Speech recognition runs in an offscreen document because Chrome extension
// sidepanels cannot trigger microphone permission prompts.
// The initial mic permission must be granted from a visible extension page
// (mic-permission.html) because offscreen documents also can't show prompts.
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [segments, setSegments] = useState<VoiceSegment[]>([])
  const [error, setError] = useState<string | null>(null)

  // Check mic permission on mount
  useEffect(() => {
    if (!navigator.permissions?.query) {
      setMicPermission('unknown')
      return
    }
    navigator.permissions.query({ name: 'microphone' as PermissionName })
      .then(status => {
        setMicPermission(status.state as typeof micPermission)
        status.onchange = () => setMicPermission(status.state as typeof micPermission)
      })
      .catch(() => setMicPermission('unknown'))
  }, [])

  // Listen for messages from offscreen document and mic-permission page
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
        setMicPermission('granted')
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  // Open the permission page in a new tab (call before starting capture)
  const requestMicPermission = useCallback(() => {
    window.open(chrome.runtime.getURL('mic-permission.html'))
  }, [])

  const start = useCallback(async (captureStartedAt: number) => {
    setTranscript('')
    setInterimTranscript('')
    setSegments([])
    setError(null)

    // If mic isn't granted, don't block the capture — just skip speech
    if (micPermission !== 'granted' && micPermission !== 'unknown') {
      setError('Microphone not enabled. Click "Setup Microphone" before capturing.')
      return
    }

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
  }, [micPermission])

  const stop = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_SPEECH_STOP' })
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  return {
    isAvailable: true, isListening, micPermission,
    transcript, interimTranscript, segments, error,
    requestMicPermission, start, stop,
  }
}
