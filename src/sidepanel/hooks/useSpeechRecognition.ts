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

// Speech recognition runs in mic-permission.html (a visible extension tab)
// because neither sidepanels nor offscreen documents can reliably get mic access.
// The tab must stay open during capture. On sidepanel mount, we ensure the tab
// exists — reopening it silently if the browser was restarted.
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [micPermission, setMicPermission] = useState<'checking' | 'granted' | 'needs-setup'>('checking')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [segments, setSegments] = useState<VoiceSegment[]>([])
  const [error, setError] = useState<string | null>(null)
  const tabReadyRef = useRef(false)

  // Ensure mic-permission tab is alive on mount
  useEffect(() => {
    async function ensureMicTab() {
      const hasFlag = await chrome.storage.local.get(MIC_GRANTED_KEY)
        .then(s => !!s[MIC_GRANTED_KEY])
        .catch(() => false)

      // Ping the mic tab to see if it's alive
      const tabAlive = await new Promise<boolean>(resolve => {
        chrome.runtime.sendMessage({ type: 'MIC_TAB_PING' }, response => {
          // If no tab is listening, Chrome sets lastError
          if (chrome.runtime.lastError || !response?.alive) {
            resolve(false)
          } else {
            resolve(true)
          }
        })
      })

      if (tabAlive) {
        // Tab is alive — we're good
        tabReadyRef.current = true
        setMicPermission(hasFlag ? 'granted' : 'needs-setup')
        return
      }

      // Tab is not alive — open it
      // If permission was previously granted, the tab will auto-detect and hide the button
      window.open(chrome.runtime.getURL('mic-permission.html'))
      setMicPermission(hasFlag ? 'granted' : 'needs-setup')
    }

    ensureMicTab()
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
      } else if (message.type === 'MIC_TAB_READY') {
        tabReadyRef.current = true
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
      setError('Microphone not enabled. Grant permission in the PointDev tab first.')
      return
    }

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
