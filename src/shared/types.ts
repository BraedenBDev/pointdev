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

  screenshots: AnnotatedScreenshot[]

  consoleErrors: ConsoleEntry[]
  failedRequests: FailedRequest[]
}

export type ScreenshotTrigger = 'frame-diff' | 'dwell' | 'voice' | 'annotation' | 'multi'

export interface AnnotatedScreenshot {
  dataUrl: string
  timestampMs: number
  viewport: { scrollX: number; scrollY: number }
  annotationIndices: number[]
  descriptionParts: string[]
  voiceContext?: string
  trigger?: ScreenshotTrigger
  interestScore?: number
  signals?: {
    frameDiffRatio?: number
    dwellElement?: string
    dwellDurationMs?: number
    voiceSegment?: string
  }
}

export interface BoxModel {
  content: { width: number; height: number }
  padding: { top: number; right: number; bottom: number; left: number }
  border: { top: number; right: number; bottom: number; left: number }
  margin: { top: number; right: number; bottom: number; left: number }
}

export interface SelectedElementData {
  selector: string
  computedStyles: Record<string, string>
  boxModel?: BoxModel
  domSubtree: string
  boundingRect: DOMRect
  reactComponent?: {
    name: string
    filePath?: string
  }
  cssVariables?: Record<string, string>
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
  type: 'circle' | 'arrow' | 'freehand' | 'rectangle'
  coordinates: CircleCoords | ArrowCoords | FreehandCoords | RectangleCoords
  timestampMs: number
  nearestElement?: string
  nearestElementContext?: {
    computedStyles: Record<string, string>
    boxModel?: BoxModel
    domSubtree: string
  }
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

export interface FreehandCoords {
  points: Array<{ x: number; y: number }>
}

export interface RectangleCoords {
  x: number
  y: number
  width: number
  height: number
}

export interface CursorSampleData {
  x: number
  y: number
  timestampMs: number
  nearestElement?: string
  dwellMs?: number
}

export interface ConsoleEntry {
  level: 'error' | 'warn'
  message: string
  stack?: string
  timestampMs: number
}

export interface FailedRequest {
  method: string
  url: string
  status: number
  statusText: string
  timestampMs: number
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
    consoleErrors: [],
    failedRequests: [],
  }
}
