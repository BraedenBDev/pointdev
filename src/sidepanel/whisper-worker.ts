/**
 * WHISPER ON-DEVICE STT — UNDER DEVELOPMENT
 *
 * Status: Functional but too slow for production real-time use.
 * Latency: ~6-8s per 3s audio chunk (single-threaded WASM).
 * Constraint: Chrome MV3 CSP blocks blob: URLs needed for multi-threaded ONNX.
 * Default: Web Speech API is the production voice engine.
 * Tracking: https://github.com/BraedenBDev/pointdev/issues/43
 */
import { pipeline, env } from '@xenova/transformers'

// Chrome extension workers can't access local filesystem — always fetch from Hub
// The browser's HTTP cache handles repeat downloads automatically
env.allowLocalModels = false

// Disable multi-threaded WASM — Chrome MV3 CSP blocks blob: URLs needed for sub-workers
env.backends.onnx.wasm.numThreads = 1

interface WorkerInMessage {
  type: 'init' | 'process_audio'
  modelId?: string
  audioData?: Float32Array
  sampleRate?: number
}

interface WorkerOutMessage {
  type: 'ready' | 'progress' | 'transcript' | 'error'
  progress?: number
  text?: string
  error?: string
}

let transcriber: any = null

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data

  if (msg.type === 'init') {
    try {
      const ALLOWED_MODELS = ['Xenova/whisper-tiny.en', 'Xenova/whisper-small.en', 'Xenova/whisper-base.en']
      const modelId = msg.modelId && ALLOWED_MODELS.includes(msg.modelId) ? msg.modelId : 'Xenova/whisper-tiny.en'

      self.postMessage({ type: 'progress', progress: 0 } as WorkerOutMessage)

      transcriber = await pipeline('automatic-speech-recognition', modelId, {
        progress_callback: (p: any) => {
          if (p.status === 'progress' && p.total > 0) {
            self.postMessage({
              type: 'progress',
              progress: p.loaded / p.total,
            } as WorkerOutMessage)
          }
        },
      })

      self.postMessage({ type: 'ready' } as WorkerOutMessage)
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) } as WorkerOutMessage)
    }
  }

  if (msg.type === 'process_audio') {
    if (!transcriber) {
      self.postMessage({ type: 'error', error: 'Model not loaded' } as WorkerOutMessage)
      return
    }

    try {
      const audioData = msg.audioData!
      const result = await transcriber(audioData, {
        sampling_rate: msg.sampleRate || 16000,
        return_timestamps: false,
      })

      const text = (result.text || '').trim()
      if (text) {
        self.postMessage({ type: 'transcript', text } as WorkerOutMessage)
      }
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) } as WorkerOutMessage)
    }
  }
}
