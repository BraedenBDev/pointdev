type VoiceEngine = 'web-speech' | 'whisper'

let recognition: any = null
let audioContext: AudioContext | null = null
let stream: MediaStream | null = null
let worker: Worker | null = null
let source: MediaStreamAudioSourceNode | null = null
let processor: ScriptProcessorNode | null = null
let captureStartedAt = 0

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'VOICE_START') {
    startVoice(message.engine, message.captureStartedAt)
    sendResponse({ ok: true })
    return false
  }
  if (message.type === 'VOICE_STOP') {
    stopVoice()
    sendResponse({ ok: true })
    return false
  }
  return false
})

async function startVoice(engine: VoiceEngine, startedAt: number) {
  captureStartedAt = startedAt

  if (engine === 'web-speech') {
    startWebSpeech()
  } else {
    await startWhisper()
  }
}

function stopVoice() {
  // Stop Web Speech
  if (recognition) {
    const r = recognition
    recognition = null
    r.onresult = null
    r.onerror = null
    r.onend = null
    r.onstart = null
    r.stop()
  }

  // Stop Whisper audio pipeline
  if (processor) {
    processor.disconnect()
    processor = null
  }
  if (source) {
    source.disconnect()
    source = null
  }
  if (audioContext) {
    audioContext.close().catch(() => {})
    audioContext = null
  }
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
  if (worker) {
    worker.terminate()
    worker = null
  }
}

// --- Web Speech API ---

function startWebSpeech() {
  const SpeechRecognitionCtor = (self as any).SpeechRecognition || (self as any).webkitSpeechRecognition
  if (!SpeechRecognitionCtor) {
    chrome.runtime.sendMessage({ type: 'VOICE_ERROR', error: 'Speech recognition not available' })
    return
  }

  recognition = new SpeechRecognitionCtor()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = navigator.language

  let processedResults = 0

  recognition.onresult = (event: any) => {
    for (let i = processedResults; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) {
        const text = result[0].transcript.trim()
        if (text) {
          const now = Date.now()
          chrome.runtime.sendMessage({
            type: 'TRANSCRIPT_UPDATE',
            data: {
              transcript: text,
              segment: {
                text,
                startMs: now - captureStartedAt - 1000,
                endMs: now - captureStartedAt,
              },
            },
          })
        }
        processedResults = i + 1
      }
    }
  }

  recognition.onerror = (event: any) => {
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      chrome.runtime.sendMessage({ type: 'VOICE_ERROR', error: 'Speech error: ' + event.error })
    }
  }

  recognition.onend = () => {
    // Auto-restart for continuous recognition
    if (recognition) {
      try { recognition.start() } catch { /* already stopped */ }
    }
  }

  recognition.start()
}

// --- Whisper (on-device) ---

async function startWhisper() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
    })
  } catch (err) {
    chrome.runtime.sendMessage({ type: 'VOICE_ERROR', error: 'Microphone access denied: ' + String(err) })
    return
  }

  // Create worker — reference the same whisper-worker
  worker = new Worker(
    new URL('../sidepanel/whisper-worker.ts', import.meta.url),
    { type: 'module' }
  )

  worker.onmessage = (e) => {
    const msg = e.data
    if (msg.type === 'progress') {
      chrome.runtime.sendMessage({ type: 'WHISPER_PROGRESS', progress: msg.progress })
    } else if (msg.type === 'ready') {
      chrome.runtime.sendMessage({ type: 'WHISPER_READY' })
      startAudioCapture()
    } else if (msg.type === 'transcript' && msg.text) {
      const now = Date.now()
      chrome.runtime.sendMessage({
        type: 'TRANSCRIPT_UPDATE',
        data: {
          transcript: msg.text,
          segment: {
            text: msg.text,
            startMs: now - captureStartedAt - 1000,
            endMs: now - captureStartedAt,
          },
        },
      })
    } else if (msg.type === 'error') {
      chrome.runtime.sendMessage({ type: 'VOICE_ERROR', error: msg.error })
      stopVoice()
    }
  }

  worker.postMessage({ type: 'init' })
}

function startAudioCapture() {
  if (!stream || !worker) return

  audioContext = new AudioContext({ sampleRate: 16000 })
  source = audioContext.createMediaStreamSource(stream)
  processor = audioContext.createScriptProcessor(4096, 1, 1)

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

      worker!.postMessage({
        type: 'process_audio',
        audioData: combined,
        sampleRate: 16000,
      }, [combined.buffer])

      audioBuffer = []
      lastProcessTime = Date.now()
    }
  }

  const silentDest = audioContext.createMediaStreamDestination()
  source.connect(processor)
  processor.connect(silentDest)
}
