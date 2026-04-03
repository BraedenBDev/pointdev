import { useState, useCallback, useRef, useEffect } from 'react'
import type { VoiceSegment } from '@shared/types'

type WhisperState = 'idle' | 'downloading' | 'ready' | 'listening' | 'error'

interface UseWhisperRecognitionReturn {
  isAvailable: boolean
  isListening: boolean
  micPermission: 'checking' | 'granted' | 'needs-setup'
  transcript: string
  interimTranscript: string
  segments: VoiceSegment[]
  error: string | null
  modelState: WhisperState
  downloadProgress: number
  requestMicPermission: () => void
  start: (captureStartedAt: number) => void
  stop: () => void
}

export function useWhisperRecognition(): UseWhisperRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  // Start as 'needs-setup' — mic is checked when user selects this engine, not on mount
  const [micPermission, setMicPermission] = useState<'checking' | 'granted' | 'needs-setup'>('needs-setup')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [segments, setSegments] = useState<VoiceSegment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [modelState, setModelState] = useState<WhisperState>('idle')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const workerRef = useRef<Worker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const captureStartRef = useRef(0)

  const requestMicPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      setMicPermission('granted')
    } catch {
      setError('Microphone access denied.')
    }
  }, [])

  const start = useCallback((captureStartedAt: number) => {
    if (micPermission !== 'granted') {
      setError('Microphone not enabled.')
      return
    }

    captureStartRef.current = captureStartedAt
    setTranscript('')
    setInterimTranscript('')
    setSegments([])
    setError(null)

    const worker = new Worker(
      new URL('../whisper-worker.ts', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setModelState('downloading')
        setDownloadProgress(msg.progress)
      } else if (msg.type === 'ready') {
        setModelState('ready')
        startAudioCapture(worker)
      } else if (msg.type === 'transcript' && msg.text) {
        const now = Date.now()
        const segment: VoiceSegment = {
          text: msg.text,
          startMs: now - captureStartRef.current - 1000,
          endMs: now - captureStartRef.current,
        }
        setSegments(prev => {
          const updated = [...prev, segment]
          setTranscript(updated.map(s => s.text).join(' '))
          return updated
        })
      } else if (msg.type === 'error') {
        setError(msg.error)
        setModelState('error')
      }
    }

    workerRef.current = worker
    worker.postMessage({ type: 'init' })
    setModelState('downloading')
  }, [micPermission])

  const startAudioCapture = useCallback(async (worker: Worker) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
      })
      streamRef.current = stream
      setIsListening(true)
      setModelState('listening')

      // NOTE: ScriptProcessorNode is deprecated — migrate to AudioWorklet in future
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      let audioBuffer: Float32Array[] = []
      const CHUNK_DURATION_MS = 3000
      let lastProcessTime = Date.now()

      processor.onaudioprocess = (e) => {
        const channelData = e.inputBuffer.getChannelData(0)
        audioBuffer.push(new Float32Array(channelData))

        if (Date.now() - lastProcessTime >= CHUNK_DURATION_MS) {
          const totalLength = audioBuffer.reduce((sum, b) => sum + b.length, 0)
          const combined = new Float32Array(totalLength)
          let offset = 0
          for (const buf of audioBuffer) {
            combined.set(buf, offset)
            offset += buf.length
          }

          worker.postMessage({
            type: 'process_audio',
            audioData: combined,
            sampleRate: 16000,
          }, [combined.buffer])

          audioBuffer = []
          lastProcessTime = Date.now()
          setInterimTranscript('Processing...')
        }
      }

      // Connect processor to a silent destination to avoid audio echo
      // ScriptProcessorNode requires an output connection to fire onaudioprocess
      const silentDest = audioContext.createMediaStreamDestination()
      source.connect(processor)
      processor.connect(silentDest)
    } catch (err) {
      setError('Failed to start audio capture: ' + String(err))
    }
  }, [])

  const stop = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
    setIsListening(false)
    setInterimTranscript('')
    setModelState('idle')
  }, [])

  // Clean up all resources on unmount
  useEffect(() => () => stop(), [stop])

  return {
    isAvailable: typeof Worker !== 'undefined',
    isListening,
    micPermission,
    transcript,
    interimTranscript,
    segments,
    error,
    modelState,
    downloadProgress,
    requestMicPermission,
    start,
    stop,
  }
}
