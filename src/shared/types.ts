export interface DeviceMetadata {
  userAgent: string
  browser: { name: string; version: string }
  os: string
  language: string
  screen: { width: number; height: number }
  window: { innerWidth: number; innerHeight: number; outerWidth: number; outerHeight: number }
  devicePixelRatio: number
  touchSupport: boolean
  colorScheme: 'light' | 'dark' | 'unknown'
}

export interface CaptureSession {
  id: string
  tabId: number
  startedAt: number
  url: string
  title: string
  viewport: { width: number; height: number }
  device: DeviceMetadata | null

  selectedElement: SelectedElementData | null

  voiceRecording: VoiceRecordingData | null

  annotations: AnnotationData[]

  cursorTrace: CursorSampleData[]

  screenshots: ElementScreenshot[]
}

export interface ElementScreenshot {
  selector: string
  timestampMs: number
  dataUrl: string
  width: number
  height: number
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
    device: null,
    selectedElement: null,
    voiceRecording: null,
    annotations: [],
    cursorTrace: [],
    screenshots: [],
  }
}
