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

const MIC_GRANTED_KEY = 'pointdev_mic_granted'

// Speech recognition runs in mic-permission.html (a visible extension tab)
// because neither sidepanels nor offscreen documents can reliably get mic access.
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
      try {
        const stored = await chrome.storage.local.get(MIC_GRANTED_KEY)
        if (stored[MIC_GRANTED_KEY]) {
          setMicPermission('granted')
          return
        }
      } catch {
        // storage not available in test
      }

      // Not granted — auto-open the permission page
      setMicPermission('needs-setup')
      window.open(chrome.runtime.getURL('mic-permission.html'))
    }

    checkMic()
  }, [])

  // Listen for messages from the mic-permission tab
  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'SPEECH_STARTED') {
        setIsListening(true)
      } else if (message.type === 'SPEECH_RESULT') {
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
      } else if (message.type === 'SPEECH_ERROR') {
        setError(message.error)
        setIsListening(false)
      } else if (message.type === 'MIC_PERMISSION_GRANTED') {
        setMicPermission('granted')
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

    // Send start command to mic-permission.html tab via broadcast
    chrome.runtime.sendMessage({
      type: 'SPEECH_START',
      captureStartedAt,
    })
  }, [micPermission])

  const stop = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'SPEECH_STOP' })
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  return {
    isAvailable: true, isListening, micPermission,
    transcript, interimTranscript, segments, error,
    requestMicPermission, start, stop,
  }
}
