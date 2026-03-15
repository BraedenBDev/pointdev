export interface CaptureSession {
  id: string
  tabId: number
  startedAt: number
  url: string
  title: string
  viewport: { width: number; height: number }

  selectedElement: SelectedElementData | null

  voiceRecording: VoiceRecordingData | null

  annotations: AnnotationData[]

  cursorTrace: CursorSampleData[]

  screenshot: string | null
}

export interface SelectedElementData {
  selector: string
  computedStyles: Record<string, string>
  domSubtree: string
  boundingRect: DOMRect
  reactComponent?: {
    name: string
    filePath?: string
  }
}

export interface VoiceRecordingData {
  transcript: string
  durationMs: number
  segments: VoiceSegment[]
}

export interface VoiceSegment {
  text: string
  startMs: number
  endMs: number
}

export interface AnnotationData {
  type: 'circle' | 'arrow'
  coordinates: CircleCoords | ArrowCoords
  timestampMs: number
  nearestElement?: string
}

export interface CircleCoords {
  centerX: number
  centerY: number
  radiusX: number
  radiusY: number
}

export interface ArrowCoords {
  startX: number
  startY: number
  endX: number
  endY: number
}

export interface CursorSampleData {
  x: number
  y: number
  timestampMs: number
  nearestElement?: string
  dwellMs?: number
}

export function createEmptySession(id: string, tabId: number, url: string, title: string, viewport: { width: number; height: number }): CaptureSession {
  return {
    id,
    tabId,
    startedAt: Date.now(),
    url,
    title,
    viewport,
    selectedElement: null,
    voiceRecording: null,
    annotations: [],
    cursorTrace: [],
    screenshot: null,
  }
}
