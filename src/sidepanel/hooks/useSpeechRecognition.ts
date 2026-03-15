import { useState, useRef, useCallback } from 'react'
import type { VoiceSegment } from '@shared/types'

function getSpeechRecognitionAPI(): any {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

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

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [segments, setSegments] = useState<VoiceSegment[]>([])
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const captureStartRef = useRef<number>(0)
  const processedResultsRef = useRef<number>(0)

  const isAvailable = getSpeechRecognitionAPI() != null

  const start = useCallback((captureStartedAt: number) => {
    const SpeechRecognition = getSpeechRecognitionAPI()
    if (!SpeechRecognition) {
      setError('Speech recognition is not available in this browser')
      return
    }

    captureStartRef.current = captureStartedAt
    processedResultsRef.current = 0
    setTranscript('')
    setInterimTranscript('')
    setSegments([])
    setError(null)

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language

    recognition.onresult = (event: any) => {
      let interim = ''
      const newSegments: VoiceSegment[] = []

      // Only process results we haven't seen yet (Web Speech API results are cumulative)
      for (let i = processedResultsRef.current; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          if (text) {
            const now = Date.now()
            newSegments.push({
              text,
              startMs: now - captureStartRef.current - 1000, // approximate
              endMs: now - captureStartRef.current,
            })
          }
          processedResultsRef.current = i + 1
        } else {
          interim += result[0].transcript
        }
      }

      if (newSegments.length > 0) {
        setSegments(prev => {
          const updated = [...prev, ...newSegments]
          setTranscript(updated.map(s => s.text).join(' '))
          return updated
        })
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setError('Microphone access is needed for voice capture.')
      } else if (event.error !== 'no-speech') {
        setError(`Speech recognition error: ${event.error}`)
      }
    }

    recognition.onend = () => {
      // Restart if still supposed to be listening (continuous mode can stop unexpectedly)
      if (recognitionRef.current === recognition) {
        try { recognition.start() } catch { setIsListening(false) }
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      const recognition = recognitionRef.current
      recognitionRef.current = null
      recognition.stop()
    }
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  return { isAvailable, isListening, transcript, interimTranscript, segments, error, start, stop }
}
