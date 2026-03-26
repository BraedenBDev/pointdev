// Messages from main thread → worker
interface WorkerInMessage {
  type: 'init' | 'process_audio'
  modelUrl?: string      // for 'init'
  audioData?: Float32Array // for 'process_audio'
  sampleRate?: number     // for 'process_audio'
}

// Messages from worker → main thread
interface WorkerOutMessage {
  type: 'ready' | 'progress' | 'transcript' | 'error'
  progress?: number       // 0-1 for model download
  text?: string           // transcribed text
  error?: string
}

// The worker loads whisper.cpp WASM and processes audio chunks
let whisperModule: any = null

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data

  if (msg.type === 'init') {
    try {
      // Load the whisper.cpp WASM module
      // This loads from the CDN — the model is cached by the browser
      const modelUrl = msg.modelUrl || 'https://whisper.ggerganov.com/ggml-model-whisper-tiny.en-q5_1.bin'

      self.postMessage({ type: 'progress', progress: 0 } as WorkerOutMessage)

      const response = await fetch(modelUrl)
      if (!response.ok) throw new Error(`Model download failed: ${response.status}`)
      if (!response.body) throw new Error('Response body is null')
      const reader = response.body.getReader()
      const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10)
      let received = 0
      const chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        if (contentLength > 0) {
          self.postMessage({ type: 'progress', progress: received / contentLength } as WorkerOutMessage)
        }
      }

      const modelData = new Uint8Array(received)
      let offset = 0
      for (const chunk of chunks) {
        modelData.set(chunk, offset)
        offset += chunk.length
      }

      // Store model data for processing
      whisperModule = { modelData }
      self.postMessage({ type: 'ready' } as WorkerOutMessage)
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) } as WorkerOutMessage)
    }
  }

  if (msg.type === 'process_audio') {
    if (!whisperModule) {
      self.postMessage({ type: 'error', error: 'Model not loaded' } as WorkerOutMessage)
      return
    }

    try {
      // Placeholder: actual whisper.cpp WASM inference goes here
      // For now, this demonstrates the message interface
      // Real implementation requires compiling whisper.cpp to WASM
      // and calling the C API via Emscripten bindings
      self.postMessage({
        type: 'transcript',
        text: '[Whisper integration pending — WASM compilation required]',
      } as WorkerOutMessage)
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) } as WorkerOutMessage)
    }
  }
}
