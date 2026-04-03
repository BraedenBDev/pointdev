import { useState, useEffect, useCallback, useRef } from 'react'
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
function getSpeechRecognitionAPI() {
  return typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined
}

// Speech recognition now runs directly in the sidepanel context.
// The mic-permission tab is only used as a one-time permission gate
// (it auto-closes after granting). Once permission is granted at the
// extension origin, SpeechRecognition works in any extension page.
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [micPermission, setMicPermission] = useState<'checking' | 'granted' | 'needs-setup'>('checking')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [segments, setSegments] = useState<VoiceSegment[]>([])
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const captureStartRef = useRef(0)
  const processedResultsRef = useRef(0)

  // Check mic permission on mount
  useEffect(() => {
    async function checkPermission() {
      // First check storage flag
      const hasFlag = await chrome.storage.local.get(MIC_GRANTED_KEY)
        .then(s => !!s[MIC_GRANTED_KEY])
        .catch(() => false)

      if (hasFlag) {
        // Verify permission is still granted
        try {
          const permStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          if (permStatus.state === 'granted') {
            setMicPermission('granted')
            return
          }
        } catch {
          // permissions.query not available — try getUserMedia
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.getTracks().forEach(t => t.stop())
            setMicPermission('granted')
            return
          } catch {
            // Permission revoked or not available
          }
        }
      }

      setMicPermission('needs-setup')
    }

    checkPermission()
  }, [])

  // Listen for MIC_PERMISSION_GRANTED from the permission tab
  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'MIC_PERMISSION_GRANTED') {
        setMicPermission('granted')
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const requestMicPermission = useCallback(async () => {
    // Try getting permission directly in sidepanel first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      chrome.storage.local.set({ [MIC_GRANTED_KEY]: true })
      setMicPermission('granted')
      return
    } catch {
      // Sidepanel can't show permission prompt — fall back to tab
    }
    window.open(chrome.runtime.getURL('mic-permission.html'))
  }, [])

  const start = useCallback((captureStartedAt: number) => {
    const SpeechRecognitionCtor = getSpeechRecognitionAPI()
    if (!SpeechRecognitionCtor) {
      setError('Speech recognition not available in this browser.')
      return
    }
    if (micPermission !== 'granted') {
      setError('Microphone not enabled. Click "Setup Microphone" first.')
      return
    }

    setTranscript('')
    setInterimTranscript('')
    setSegments([])
    setError(null)
    captureStartRef.current = captureStartedAt
    processedResultsRef.current = 0

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: any) => {
      let interim = ''
      const newSegments: VoiceSegment[] = []

      for (let i = processedResultsRef.current; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          if (text) {
            const now = Date.now()
            newSegments.push({
              text,
              startMs: now - captureStartRef.current - 1000,
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
        setError('Microphone access denied. Please grant permission and try again.')
        setMicPermission('needs-setup')
        chrome.storage.local.remove(MIC_GRANTED_KEY)
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError('Speech error: ' + event.error)
      }
    }

    recognition.onend = () => {
      // Auto-restart for continuous recognition while ref is set
      if (recognitionRef.current === recognition) {
        try { recognition.start() } catch { /* already stopped */ }
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [micPermission])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      const r = recognitionRef.current
      recognitionRef.current = null
      r.onresult = null
      r.onerror = null
      r.onend = null
      r.onstart = null
      r.stop()
    }
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  return {
    isAvailable: !!getSpeechRecognitionAPI(),
    isListening, micPermission,
    transcript, interimTranscript, segments, error,
    requestMicPermission, start, stop,
  }
}
