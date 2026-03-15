import type { SelectedElementData, AnnotationData, CursorSampleData, VoiceSegment, CaptureSession } from './types'

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

  // Content Script → Service Worker
  | { type: 'ELEMENT_SELECTED'; data: SelectedElementData }
  | { type: 'ANNOTATION_ADDED'; data: AnnotationData }
  | { type: 'CURSOR_BATCH'; data: CursorSampleData[] }
  | { type: 'PONG' }

  // Service Worker → Sidepanel
  | { type: 'SESSION_UPDATED'; session: CaptureSession }
  | { type: 'CAPTURE_COMPLETE'; session: CaptureSession }
  | { type: 'CAPTURE_ERROR'; error: string }

export type CaptureMode = 'select' | 'circle' | 'arrow'
