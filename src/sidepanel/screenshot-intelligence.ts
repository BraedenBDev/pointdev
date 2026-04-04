import type { SmartScreenshotSignals, ScreenshotTrigger } from '@shared/messages'

export interface InterestSignals {
  frameDiffRatio: number
  dwellActive: boolean
  dwellElement?: string
  dwellDurationMs?: number
  voiceActive: boolean
  voiceSegment?: string
  annotationJustMade: boolean
}

// Weights for each signal in the interest score
const WEIGHT_FRAME_DIFF = 0.3
const WEIGHT_DWELL = 0.25
const WEIGHT_VOICE = 0.35
// annotation = always 1.0 (bypass)

// Frame diff thresholds
const PIXEL_DIFF_THRESHOLD = 90    // RGB channel distance sum to count as "changed"
const CHANGE_RATIO_THRESHOLD = 0.05 // 5% of pixels must change to register

// Sampling config
const SAMPLE_WIDTH = 160
const SAMPLE_HEIGHT = 90
const SAMPLE_INTERVAL_MS = 2000
const COOLDOWN_MS = 3000
const INTEREST_THRESHOLD = 0.3
// Sample every 4th pixel for frame diff (75% reduction in comparisons)
const PIXEL_STRIDE = 4

export type OnInterestingFrame = (signals: SmartScreenshotSignals) => void

/**
 * ScreenshotIntelligence uses periodic captureVisibleTab snapshots
 * (via service worker) for frame differencing instead of tabCapture
 * MediaStream, because tabCapture requires activeTab user gesture
 * which conflicts with sidepanel activation.
 */
export class ScreenshotIntelligence {
  private canvas: OffscreenCanvas
  private ctx: OffscreenCanvasRenderingContext2D
  private prevFrameData: Uint8ClampedArray | null = null
  private intervalId: number | null = null
  private captureStartedAt = 0

  // External signal state
  private _voiceActive = false
  private _voiceSegment = ''
  private _lastFinalSegment = ''
  private _lastFinalSegmentTime = 0
  private _dwellActive = false
  private _dwellElement = ''
  private _dwellDurationMs = 0

  // Keep finalized voice context for 5s after speech ends
  private static readonly VOICE_CONTEXT_RETENTION_MS = 5000

  private lastCaptureTime = 0
  private onInterestingFrame: OnInterestingFrame

  constructor(onInterestingFrame: OnInterestingFrame) {
    this.onInterestingFrame = onInterestingFrame
    this.canvas = new OffscreenCanvas(SAMPLE_WIDTH, SAMPLE_HEIGHT)
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
  }

  start(captureStartedAt: number): void {
    this.captureStartedAt = captureStartedAt
    this.intervalId = window.setInterval(() => this.sampleFrame().catch(() => {}), SAMPLE_INTERVAL_MS)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.prevFrameData = null
    this._lastFinalSegment = ''
    this._lastFinalSegmentTime = 0
  }

  /** Update voice activity signal — call from speech recognition callbacks */
  setVoiceActive(active: boolean, segment?: string): void {
    this._voiceActive = active
    if (segment) {
      this._voiceSegment = segment
      this._lastFinalSegment = segment
      this._lastFinalSegmentTime = Date.now()
    } else if (!active) {
      // Voice went silent — keep active + segment for a retention window
      // so screenshots captured shortly after speech still trigger
      const elapsed = Date.now() - this._lastFinalSegmentTime
      if (this._lastFinalSegmentTime > 0 && elapsed < ScreenshotIntelligence.VOICE_CONTEXT_RETENTION_MS) {
        this._voiceActive = true
        this._voiceSegment = this._lastFinalSegment
      } else {
        this._voiceActive = false
        this._voiceSegment = ''
      }
    }
  }

  /** Update dwell signal — call from DWELL_UPDATE messages */
  setDwellActive(active: boolean, element?: string, durationMs?: number): void {
    this._dwellActive = active
    this._dwellElement = element || ''
    this._dwellDurationMs = durationMs || 0
  }

  /** Call when user makes an annotation — bypasses scoring, always captures */
  triggerAnnotation(annotationIndex: number): void {
    this.lastCaptureTime = Date.now()
    this.onInterestingFrame({
      trigger: 'annotation',
      interestScore: 1.0,
      dwellElement: this._dwellElement || undefined,
      dwellDurationMs: this._dwellDurationMs || undefined,
      voiceSegment: this._voiceSegment || undefined,
      annotationIndex,
    })
  }

  private async sampleFrame(): Promise<void> {
    // Request a low-quality snapshot from the service worker
    let dataUrl: string
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SNAPSHOT_REQUEST' })
      if (!response?.dataUrl) return
      dataUrl = response.dataUrl
    } catch {
      return // Service worker unavailable
    }

    // Decode the data URL into pixel data at low resolution
    // Use direct base64→blob instead of fetch(dataUrl) which can fail in extension pages
    const [header, b64] = dataUrl.split(',')
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const img = await createImageBitmap(new Blob([bytes], { type: mime }))
    this.ctx.drawImage(img, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
    img.close()
    const { data } = this.ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)

    const frameDiffRatio = this.computeFrameDiff(data)

    // Store current frame as previous for next diff comparison
    if (!this.prevFrameData || this.prevFrameData.length !== data.length) {
      this.prevFrameData = new Uint8ClampedArray(data)
    } else {
      this.prevFrameData.set(data)
    }

    const signals: InterestSignals = {
      frameDiffRatio,
      dwellActive: this._dwellActive,
      dwellElement: this._dwellElement || undefined,
      dwellDurationMs: this._dwellDurationMs || undefined,
      voiceActive: this._voiceActive,
      voiceSegment: this._voiceSegment || undefined,
      annotationJustMade: false,
    }

    const score = computeInterestScore(signals)

    const now = Date.now()
    if (score > INTEREST_THRESHOLD && (now - this.lastCaptureTime) > COOLDOWN_MS) {
      this.lastCaptureTime = now
      this.onInterestingFrame(buildSmartSignals(signals, score))
    }
  }

  private computeFrameDiff(currentData: Uint8ClampedArray): number {
    if (!this.prevFrameData) return 0 // First frame has no reference — report no change

    let changedPixels = 0
    let sampledPixels = 0
    const byteStride = PIXEL_STRIDE * 4

    for (let i = 0; i < currentData.length; i += byteStride) {
      sampledPixels++
      const dr = Math.abs(currentData[i] - this.prevFrameData[i])
      const dg = Math.abs(currentData[i + 1] - this.prevFrameData[i + 1])
      const db = Math.abs(currentData[i + 2] - this.prevFrameData[i + 2])
      if (dr + dg + db > PIXEL_DIFF_THRESHOLD) changedPixels++
    }

    return changedPixels / sampledPixels
  }
}

/** Exported for testing */
export function computeInterestScore(signals: InterestSignals): number {
  if (signals.annotationJustMade) return 1.0

  const frameDiffScore = signals.frameDiffRatio >= CHANGE_RATIO_THRESHOLD
    ? Math.min(signals.frameDiffRatio * 2, 1.0) // Scale up, cap at 1
    : 0
  const dwellScore = signals.dwellActive ? 1.0 : 0
  const voiceScore = signals.voiceActive ? 1.0 : 0

  return (frameDiffScore * WEIGHT_FRAME_DIFF) +
         (dwellScore * WEIGHT_DWELL) +
         (voiceScore * WEIGHT_VOICE)
}

/** Determine the primary trigger from signals */
function determineTrigger(signals: InterestSignals): ScreenshotTrigger {
  if (signals.annotationJustMade) return 'annotation'

  const active: ScreenshotTrigger[] = []
  if (signals.frameDiffRatio >= CHANGE_RATIO_THRESHOLD) active.push('frame-diff')
  if (signals.dwellActive) active.push('dwell')
  if (signals.voiceActive) active.push('voice')

  if (active.length > 1) return 'multi'
  if (active.length === 1) return active[0]
  return 'frame-diff' // fallback
}

function buildSmartSignals(signals: InterestSignals, score: number): SmartScreenshotSignals {
  return {
    trigger: determineTrigger(signals),
    interestScore: Math.round(score * 100) / 100,
    frameDiffRatio: Math.round(signals.frameDiffRatio * 1000) / 1000,
    dwellElement: signals.dwellElement,
    dwellDurationMs: signals.dwellDurationMs,
    voiceSegment: signals.voiceSegment,
  }
}
