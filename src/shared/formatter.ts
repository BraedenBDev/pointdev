import type { CaptureSession, CircleCoords, ArrowCoords } from './types'

export function formatSession(session: CaptureSession): string {
  const sections: string[] = []

  sections.push(formatContext(session))

  if (session.selectedElement) {
    sections.push(formatTargetElement(session))
  }

  if (session.voiceRecording && session.voiceRecording.segments.length > 0) {
    sections.push(formatVoiceTranscript(session))
  }

  if (session.annotations.length > 0) {
    sections.push(formatAnnotations(session))
  }

  const dwells = getUnsuppressedDwells(session)
  if (dwells.length > 0) {
    sections.push(formatCursorBehavior(dwells, session))
  }

  if (session.screenshots.length > 0) {
    sections.push(formatScreenshots(session))
  }

  return sections.join('\n\n')
}

function formatContext(session: CaptureSession): string {
  const lines = [
    '## Context',
    `- URL: ${session.url}`,
    `- Page title: ${session.title}`,
    `- Viewport: ${session.viewport.width} x ${session.viewport.height}px`,
    `- Captured at: ${new Date(session.startedAt).toISOString().replace('T', ' ').slice(0, 19)}`,
  ]
  return lines.join('\n')
}

function formatTargetElement(session: CaptureSession): string {
  const el = session.selectedElement!
  const lines = ['## Target Element', `- Selector: ${el.selector}`]

  if (el.reactComponent) {
    const filePart = el.reactComponent.filePath ? ` (${el.reactComponent.filePath})` : ''
    lines.push(`- React Component: <${el.reactComponent.name}>${filePart}`)
  }

  const computedStr = formatComputedStyles(el.computedStyles)
  if (computedStr) {
    lines.push(`- Computed: ${computedStr}`)
  }

  lines.push(`- DOM: ${truncateDom(el.domSubtree)}`)

  return lines.join('\n')
}

function formatComputedStyles(styles: Record<string, string>): string {
  const result: string[] = []

  for (const prop of ['padding', 'margin']) {
    const shorthand = reconstructShorthand(styles, prop)
    if (shorthand) result.push(shorthand)
  }

  const directProps = ['font-size', 'font-weight', 'font-family', 'color', 'background-color',
                       'width', 'height', 'display', 'position']
  for (const prop of directProps) {
    if (styles[prop]) {
      result.push(`${prop}: ${styles[prop]}`)
    }
  }

  return result.join(', ')
}

function reconstructShorthand(styles: Record<string, string>, prop: string): string | null {
  const top = styles[`${prop}-top`]
  const right = styles[`${prop}-right`]
  const bottom = styles[`${prop}-bottom`]
  const left = styles[`${prop}-left`]
  if (!top || !right || !bottom || !left) return null

  if (top === right && right === bottom && bottom === left) {
    return `${prop}: ${top}`
  }
  return `${prop}: ${top} ${right} ${bottom} ${left}`
}

function truncateDom(html: string): string {
  if (html.length <= 500) return html
  return html.slice(0, 500) + '<!-- truncated -->'
}

function formatVoiceTranscript(session: CaptureSession): string {
  const lines = ['## User Intent (voice transcript)']
  for (const seg of session.voiceRecording!.segments) {
    lines.push(`[${formatTimestamp(seg.startMs)}] "${seg.text}"`)
  }
  return lines.join('\n')
}

function formatAnnotations(session: CaptureSession): string {
  const lines = ['## Annotations']
  for (let i = 0; i < session.annotations.length; i++) {
    const ann = session.annotations[i]
    const ts = formatTimestamp(ann.timestampMs)
    const target = ann.nearestElement || 'unknown element'

    if (ann.type === 'circle') {
      const c = ann.coordinates as CircleCoords
      lines.push(`${i + 1}. [${ts}] Circle around ${target} at (${c.centerX}, ${c.centerY}), radius ${c.radiusX}px`)
    } else {
      const a = ann.coordinates as ArrowCoords
      lines.push(`${i + 1}. [${ts}] Arrow from (${a.startX}, ${a.startY}) to (${a.endX}, ${a.endY}), pointing at ${target}`)
    }
  }
  return lines.join('\n')
}

interface DwellEntry {
  x: number
  y: number
  timestampMs: number
  nearestElement?: string
  dwellMs: number
}

function getUnsuppressedDwells(session: CaptureSession): DwellEntry[] {
  const annotatedElements = new Set(session.annotations.map(a => a.nearestElement).filter(Boolean))
  return session.cursorTrace
    .filter((s): s is DwellEntry => s.dwellMs != null && s.dwellMs > 0)
    .filter(s => !s.nearestElement || !annotatedElements.has(s.nearestElement))
}

function formatCursorBehavior(dwells: DwellEntry[], session: CaptureSession): string {
  const lines = ['## Cursor Behavior']
  for (const dwell of dwells) {
    const startTs = formatTimestamp(dwell.timestampMs)
    const endTs = formatTimestamp(dwell.timestampMs + dwell.dwellMs)
    const target = dwell.nearestElement || 'unknown element'
    const seconds = (dwell.dwellMs / 1000).toFixed(1)

    // Correlate with voice segments
    let correlation = ''
    if (session.voiceRecording) {
      const overlapping = session.voiceRecording.segments.find(seg =>
        seg.startMs <= dwell.timestampMs + dwell.dwellMs && seg.endMs >= dwell.timestampMs
      )
      if (overlapping) {
        correlation = ` (during: "${overlapping.text}")`
      }
    }

    lines.push(`- [${startTs}\u2013${endTs}] Dwelled ${seconds}s over ${target}${correlation}`)
  }
  return lines.join('\n')
}

function formatScreenshots(session: CaptureSession): string {
  const lines = ['## Screenshots']
  for (let i = 0; i < session.screenshots.length; i++) {
    const s = session.screenshots[i]
    const ts = formatTimestamp(s.timestampMs)
    lines.push(`${i + 1}. [${ts}] ${s.selector} (${s.width}x${s.height}px)`)
  }
  return lines.join('\n')
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
