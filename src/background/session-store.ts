import type { CaptureSession, SelectedElementData, AnnotationData, CursorSampleData, VoiceSegment } from '@shared/types'
import { createEmptySession } from '@shared/types'

export class SessionStore {
  private session: CaptureSession | null = null

  startSession(tabId: number, url: string, title: string, viewport: { width: number; height: number }): CaptureSession {
    const id = `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.session = createEmptySession(id, tabId, url, title, viewport)
    this.persist()
    return { ...this.session }
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
    this.persist()
  }

  setScreenshot(dataUrl: string): void {
    if (!this.session) return
    this.session.screenshot = dataUrl
    this.persist()
  }

  endSession(): CaptureSession | null {
    const session = this.session
    this.session = null
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

  private persist(): void {
    try {
      chrome.storage.session.set({ activeSession: this.session })
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
