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
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [segments, setSegments] = useState<VoiceSegment[]>([])
  const [error, setError] = useState<string | null>(null)
  const isListeningRef = useRef(false)

  // Listen for messages from the offscreen document
  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'OFFSCREEN_SPEECH_STARTED') {
        setIsListening(true)
        isListeningRef.current = true
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
        isListeningRef.current = false
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const start = useCallback(async (captureStartedAt: number) => {
    setTranscript('')
    setInterimTranscript('')
    setSegments([])
    setError(null)

    // Create offscreen document if it doesn't exist
    try {
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('offscreen.html'),
        reasons: [chrome.offscreen.Reason.USER_MEDIA],
        justification: 'Voice transcription via Web Speech API requires microphone access',
      })
    } catch {
      // Document may already exist — that's fine
    }

    // Tell the offscreen document to start listening
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_SPEECH_START',
      captureStartedAt,
    })
  }, [])

  const stop = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_SPEECH_STOP' })
    setIsListening(false)
    isListeningRef.current = false
    setInterimTranscript('')
  }, [])

  // Offscreen documents are always available in MV3 with the offscreen permission
  return { isAvailable: true, isListening, transcript, interimTranscript, segments, error, start, stop }
}
