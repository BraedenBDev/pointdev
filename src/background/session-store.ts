import type { CaptureSession, SelectedElementData, AnnotationData, CursorSampleData, VoiceSegment, AnnotatedScreenshot, DeviceMetadata, ConsoleEntry, FailedRequest } from '@shared/types'
import { createEmptySession } from '@shared/types'

// Caps to prevent unbounded array growth during long sessions
const MAX_CURSOR_TRACE = 2000
const MAX_CONSOLE_ERRORS = 200
const MAX_FAILED_REQUESTS = 100

// Debounce persist to avoid excessive storage writes (cursor batches arrive at ~2Hz)
const PERSIST_DEBOUNCE_MS = 2000

export class SessionStore {
  private session: CaptureSession | null = null
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  startSession(tabId: number, url: string, title: string, viewport: { width: number; height: number }): CaptureSession {
    const id = `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.session = createEmptySession(id, tabId, url, title, viewport)
    this.persist()
    return { ...this.session }
  }

  hasSession(): boolean {
    return this.session !== null
  }

  getSession(): CaptureSession | null {
    return this.session ? { ...this.session } : null
  }

  setSelectedElement(element: SelectedElementData): void {
    if (!this.session) return
    this.session.selectedElement = element
    this.persist()
  }

  addAnnotation(annotation: AnnotationData): void {
    if (!this.session) return
    this.session.annotations.push(annotation)
    this.persist()
  }

  updateTranscript(transcript: string, segment: VoiceSegment): void {
    if (!this.session) return
    if (!this.session.voiceRecording) {
      this.session.voiceRecording = { transcript: '', durationMs: 0, segments: [] }
    }
    this.session.voiceRecording.transcript = transcript
    this.session.voiceRecording.segments.push(segment)
    this.session.voiceRecording.durationMs = segment.endMs
    this.persist()
  }

  addCursorBatch(samples: CursorSampleData[]): void {
    if (!this.session) return
    this.session.cursorTrace.push(...samples)
    if (this.session.cursorTrace.length > MAX_CURSOR_TRACE) {
      this.session.cursorTrace = this.session.cursorTrace.slice(-MAX_CURSOR_TRACE)
    }
    this.debouncedPersist()
  }

  setDeviceMetadata(device: DeviceMetadata): void {
    if (!this.session) return
    this.session.device = device
    this.persist()
  }

  addAnnotatedScreenshot(screenshot: AnnotatedScreenshot): void {
    if (!this.session) return
    // Cap at 10 screenshots (FIFO eviction)
    if (this.session.screenshots.length >= 10) {
      this.session.screenshots.shift()
    }
    this.session.screenshots.push(screenshot)
    this.persist()
  }

  updateLastScreenshot(screenshot: AnnotatedScreenshot): void {
    if (!this.session || this.session.screenshots.length === 0) return
    const last = this.session.screenshots[this.session.screenshots.length - 1]
    last.dataUrl = screenshot.dataUrl
    last.timestampMs = screenshot.timestampMs
    last.annotationIndices.push(...screenshot.annotationIndices)
    last.descriptionParts = [...new Set([...last.descriptionParts, ...screenshot.descriptionParts])]
    if (screenshot.voiceContext && !last.voiceContext) {
      last.voiceContext = screenshot.voiceContext
    }
    this.persist()
  }

  addConsoleBatch(consoleBatch: ConsoleEntry[], requestBatch: FailedRequest[]): void {
    if (!this.session) return
    this.session.consoleErrors.push(...consoleBatch)
    if (this.session.consoleErrors.length > MAX_CONSOLE_ERRORS) {
      this.session.consoleErrors = this.session.consoleErrors.slice(-MAX_CONSOLE_ERRORS)
    }
    this.session.failedRequests.push(...requestBatch)
    if (this.session.failedRequests.length > MAX_FAILED_REQUESTS) {
      this.session.failedRequests = this.session.failedRequests.slice(-MAX_FAILED_REQUESTS)
    }
    this.debouncedPersist()
  }

  endSession(): CaptureSession | null {
    const session = this.session
    this.session = null
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    this.clearPersistedSession()
    return session
  }

  async restore(): Promise<CaptureSession | null> {
    try {
      const result = await chrome.storage.session.get(['activeSession'])
      if (result.activeSession) {
        this.session = result.activeSession
        return { ...this.session! }
      }
    } catch {
      // storage.session not available (e.g., in tests without full chrome mock)
    }
    return null
  }

  private debouncedPersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      this.persistNow()
    }, PERSIST_DEBOUNCE_MS)
  }

  private persist(): void {
    // Immediate persist for important state changes (element selected, annotations, etc.)
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    this.persistNow()
  }

  private persistNow(): void {
    try {
      const sessionForStorage = {
        ...this.session,
        screenshots: this.session!.screenshots.map(s => ({ ...s, dataUrl: '' })),
      }
      chrome.storage.session.set({ activeSession: sessionForStorage })
    } catch {
      // Silently fail in environments without chrome.storage
    }
  }

  private clearPersistedSession(): void {
    try {
      chrome.storage.session.remove(['activeSession'])
    } catch {
      // Silently fail
    }
  }
}
