import { useState, useEffect, useCallback } from 'react'
import type { VoiceSegment } from '@shared/types'

interface UseSpeechRecognitionReturn {
  isAvailable: boolean
  isListening: boolean
  micPermission: 'checking' | 'granted' | 'needs-setup'
  transcript: string
  interimTranscript: string
  segments: VoiceSegment[]
  error: string | null
  requestMicPermission: () => void
  start: (captureStartedAt: number) => void
  stop: () => void
}

// Storage key to remember that mic permission was granted
const MIC_GRANTED_KEY = 'pointdev_mic_granted'

// Speech recognition runs in an offscreen document because Chrome extension
// sidepanels cannot trigger microphone permission prompts.
// The initial mic permission must be granted from a visible extension page
// (mic-permission.html) because offscreen documents also can't show prompts.
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [micPermission, setMicPermission] = useState<'checking' | 'granted' | 'needs-setup'>('checking')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [segments, setSegments] = useState<VoiceSegment[]>([])
  const [error, setError] = useState<string | null>(null)

  // Check mic permission on mount and auto-open setup if needed
  useEffect(() => {
    async function checkMic() {
      // First check our own flag (fast path)
      try {
        const stored = await chrome.storage.local.get(MIC_GRANTED_KEY)
        if (stored[MIC_GRANTED_KEY]) {
          setMicPermission('granted')
          return
        }
      } catch {
        // storage not available in test
      }

      // Try the Permissions API
      try {
        if (navigator.permissions?.query) {
          const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          if (status.state === 'granted') {
            setMicPermission('granted')
            chrome.storage.local.set({ [MIC_GRANTED_KEY]: true }).catch(() => {})
            return
          }
        }
      } catch {
        // Permissions API not available in this context
      }

      // Not granted — auto-open the permission page
      setMicPermission('needs-setup')
      window.open(chrome.runtime.getURL('mic-permission.html'))
    }

    checkMic()
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
        chrome.storage.local.set({ [MIC_GRANTED_KEY]: true }).catch(() => {})
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const requestMicPermission = useCallback(() => {
    window.open(chrome.runtime.getURL('mic-permission.html'))
  }, [])

  const start = useCallback(async (captureStartedAt: number) => {
    setTranscript('')
    setInterimTranscript('')
    setSegments([])
    setError(null)

    if (micPermission !== 'granted') {
      setError('Microphone not enabled. Grant permission first, then try again.')
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
