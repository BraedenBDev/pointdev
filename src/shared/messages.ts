import type { SelectedElementData, AnnotationData, CursorSampleData, VoiceSegment, CaptureSession, DeviceMetadata, ConsoleEntry, FailedRequest, ScreenshotTrigger } from './types'
export type { ScreenshotTrigger } from './types'

export type Message =
  // Sidepanel → Service Worker
  | { type: 'START_CAPTURE' }
  | { type: 'STOP_CAPTURE' }
  | { type: 'SET_MODE'; mode: CaptureMode }
  | { type: 'TRANSCRIPT_UPDATE'; data: { transcript: string; segment: VoiceSegment } }

  // Service Worker → Content Script
  | { type: 'INJECT_CAPTURE'; tabId: number }
  | { type: 'REMOVE_CAPTURE' }
  | { type: 'MODE_CHANGED'; mode: CaptureMode }
  | { type: 'PING' }
  | { type: 'SET_CONSOLE_NONCE'; nonce: string }

  // Service Worker → Content Script (floating card updates)
  | { type: 'TRANSCRIPT_SNIPPET'; text: string }
  | { type: 'SESSION_STATS'; annotationCount: number; screenshotCount: number }

  // Content Script → Service Worker
  | { type: 'ELEMENT_SELECTED'; data: SelectedElementData }
  | { type: 'ANNOTATION_ADDED'; data: AnnotationData }
  | { type: 'CURSOR_BATCH'; data: CursorSampleData[] }
  | { type: 'SCREENSHOT_REQUEST'; data: { timestampMs: number; viewport: { scrollX: number; scrollY: number }; annotationIndex?: number; selectedElementSelector?: string; replacesPrevious: boolean } }
  | { type: 'DEVICE_METADATA'; data: DeviceMetadata }
  | { type: 'CONSOLE_BATCH'; data: { entries: ConsoleEntry[]; requests: FailedRequest[] } }
  | { type: 'PONG' }

  // Sidepanel → Service Worker (smart screenshots)
  | { type: 'SNAPSHOT_REQUEST' }
  | { type: 'SMART_SCREENSHOT_REQUEST'; data: SmartScreenshotSignals }

  // Service Worker → Sidepanel
  | { type: 'SESSION_UPDATED'; session: CaptureSession }
  | { type: 'CAPTURE_COMPLETE'; session: CaptureSession }
  | { type: 'CAPTURE_ERROR'; error: string }
  | { type: 'DWELL_UPDATE'; data: { element: string; durationMs: number; active: boolean } }

export type CaptureMode = 'select' | 'circle' | 'arrow' | 'freehand' | 'rectangle'

export interface SmartScreenshotSignals {
  trigger: ScreenshotTrigger
  interestScore: number
  frameDiffRatio?: number
  dwellElement?: string
  dwellDurationMs?: number
  voiceSegment?: string
  annotationIndex?: number
  selectedElementSelector?: string
}
