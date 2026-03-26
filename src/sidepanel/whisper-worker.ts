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

      // Stream directly into pre-allocated buffer to halve peak memory
      const modelData = contentLength > 0
        ? new Uint8Array(contentLength)
        : new Uint8Array(0)
      let offset = 0
      const chunks: Uint8Array[] = contentLength > 0 ? [] : []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (contentLength > 0) {
          modelData.set(value, offset)
          offset += value.length
          self.postMessage({ type: 'progress', progress: offset / contentLength } as WorkerOutMessage)
        } else {
          // Unknown content length — fall back to chunk accumulation
          chunks.push(value)
          offset += value.length
        }
      }

      // If content length was unknown, assemble from chunks
      let finalData = modelData
      if (contentLength === 0 && chunks.length > 0) {
        finalData = new Uint8Array(offset)
        let pos = 0
        for (const chunk of chunks) {
          finalData.set(chunk, pos)
          pos += chunk.length
        }
      }

      whisperModule = { modelData: finalData }
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
