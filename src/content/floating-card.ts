import type { CaptureMode } from '@shared/messages'

const CARD_STYLES = `
  :host {
    all: initial;
    position: fixed;
    z-index: 2147483647;
    font-family: Inter, system-ui, -apple-system, sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .card {
    position: fixed;
    bottom: 16px;
    right: 16px;
    width: 260px;
    background: rgba(255,255,255,0.97);
    backdrop-filter: blur(16px);
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    border: 1px solid rgba(0,0,0,0.06);
    overflow: hidden;
    transition: all 0.2s ease;
    cursor: default;
  }

  .card.collapsed {
    width: auto;
    border-radius: 20px;
  }

  .header {
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-bottom: 1px solid #f1f4f6;
    cursor: grab;
    user-select: none;
  }

  .header:active { cursor: grabbing; }

  .collapsed .header {
    border-bottom: none;
    padding: 6px 14px;
  }

  .logo {
    width: 18px;
    height: 18px;
    background: #1d9972;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .title {
    font-size: 12px;
    font-weight: 600;
    color: #1e293b;
  }

  .collapsed .title { display: none; }

  .timer-group {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .rec-dot {
    width: 6px;
    height: 6px;
    background: #d64545;
    border-radius: 50%;
    animation: pulse 1.5s infinite;
  }

  .timer {
    font-size: 11px;
    font-weight: 500;
    color: #1e293b;
  }

  .body { display: block; }
  .collapsed .body { display: none; }

  .modes {
    padding: 8px 12px;
    display: flex;
    gap: 4px;
  }

  .mode-btn {
    flex: 1;
    padding: 6px 0;
    text-align: center;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 500;
    border: 1px solid #d5f9e8;
    background: #eefdf6;
    color: #1d9972;
    cursor: pointer;
    transition: all 0.15s;
  }

  .mode-btn:hover { background: #d5f9e8; }

  .mode-btn.active {
    background: #1d9972;
    color: white;
    border-color: #1d9972;
  }

  .stats {
    padding: 4px 12px 8px;
    display: flex;
    gap: 12px;
    font-size: 10px;
    color: #888;
  }

  .transcript {
    padding: 6px 12px;
    background: #f8fafb;
    font-size: 11px;
    color: #4b5563;
    border-top: 1px solid #f1f4f6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .transcript-icon { color: #1d9972; }

  .stop-area { padding: 8px 12px 10px; }

  .stop-btn {
    width: 100%;
    padding: 8px;
    background: #d64545;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .stop-btn:hover { background: #c53030; }

  .divider {
    width: 1px;
    height: 14px;
    background: #e4e8ec;
  }

  .collapsed .divider { display: inline-block; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  @media (prefers-color-scheme: dark) {
    .card {
      background: rgba(30,30,36,0.97);
      border-color: rgba(255,255,255,0.08);
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    .header { border-bottom-color: rgba(255,255,255,0.06); }
    .title, .timer { color: #e2e8f0; }
    .mode-btn {
      background: rgba(29,153,114,0.15);
      color: #4dd4a3;
      border-color: rgba(29,153,114,0.2);
    }
    .mode-btn:hover { background: rgba(29,153,114,0.25); }
    .mode-btn.active { background: #1d9972; color: white; border-color: #1d9972; }
    .stats { color: #9ca3af; }
    .transcript { background: rgba(255,255,255,0.03); border-top-color: rgba(255,255,255,0.06); color: #9ca3af; }
    .transcript-icon { color: #4dd4a3; }
    .divider { background: rgba(255,255,255,0.1); }
  }
`

const MODES: { mode: CaptureMode; label: string }[] = [
  { mode: 'select', label: 'Select' },
  { mode: 'circle', label: '\u25CB' },
  { mode: 'arrow', label: '\u2192' },
  { mode: 'freehand', label: '\u270E' },
  { mode: 'rectangle', label: '\u25A1' },
]

/**
 * Builds the card DOM tree using safe DOM methods (no innerHTML).
 * All content is hardcoded — no user input is rendered.
 */
function buildCardDOM(): DocumentFragment {
  const frag = document.createDocumentFragment()

  // Header
  const header = document.createElement('div')
  header.className = 'header'

  const logo = document.createElement('div')
  logo.className = 'logo'
  logo.textContent = 'P'
  header.appendChild(logo)

  const title = document.createElement('span')
  title.className = 'title'
  title.textContent = 'PointDev'
  header.appendChild(title)

  const timerGroup = document.createElement('div')
  timerGroup.className = 'timer-group'

  const recDot = document.createElement('div')
  recDot.className = 'rec-dot'
  timerGroup.appendChild(recDot)

  const timer = document.createElement('span')
  timer.className = 'timer'
  timer.textContent = '00:00'
  timerGroup.appendChild(timer)

  header.appendChild(timerGroup)
  frag.appendChild(header)

  // Body
  const body = document.createElement('div')
  body.className = 'body'

  const modes = document.createElement('div')
  modes.className = 'modes'
  body.appendChild(modes)

  const stats = document.createElement('div')
  stats.className = 'stats'
  body.appendChild(stats)

  const transcript = document.createElement('div')
  transcript.className = 'transcript'
  const transcriptIcon = document.createElement('span')
  transcriptIcon.className = 'transcript-icon'
  transcriptIcon.textContent = '\uD83C\uDF99'
  transcript.appendChild(transcriptIcon)
  transcript.appendChild(document.createTextNode(' Waiting for speech...'))
  body.appendChild(transcript)

  const stopArea = document.createElement('div')
  stopArea.className = 'stop-area'
  const stopBtn = document.createElement('button')
  stopBtn.className = 'stop-btn'
  stopBtn.textContent = 'Stop Capture'
  stopArea.appendChild(stopBtn)
  body.appendChild(stopArea)

  frag.appendChild(body)
  return frag
}

export class FloatingCard {
  private host: HTMLDivElement
  private shadow: ShadowRoot
  private card: HTMLDivElement
  private timerEl: HTMLSpanElement
  private statsEl: HTMLDivElement
  private transcriptEl: HTMLDivElement
  private modeButtons: HTMLButtonElement[] = []
  private isCollapsed = false
  private currentMode: CaptureMode = 'select'
  private startTime = 0
  private timerId: number | null = null

  // Drag state
  private isDragging = false
  private dragOffsetX = 0
  private dragOffsetY = 0

  constructor() {
    this.host = document.createElement('div')
    this.host.setAttribute('data-pointdev-float', '')
    this.shadow = this.host.attachShadow({ mode: 'closed' })

    // Inject styles
    const style = document.createElement('style')
    style.textContent = CARD_STYLES
    this.shadow.appendChild(style)

    // Build card using safe DOM methods
    this.card = document.createElement('div')
    this.card.className = 'card'
    this.card.appendChild(buildCardDOM())
    this.shadow.appendChild(this.card)

    this.timerEl = this.shadow.querySelector('.timer')!
    this.statsEl = this.shadow.querySelector('.stats')!
    this.transcriptEl = this.shadow.querySelector('.transcript')!

    // Build mode buttons
    const modesContainer = this.shadow.querySelector('.modes')!
    for (const { mode, label } of MODES) {
      const btn = document.createElement('button')
      btn.className = `mode-btn${mode === 'select' ? ' active' : ''}`
      btn.textContent = label
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.setMode(mode)
        chrome.runtime.sendMessage({ type: 'SET_MODE', mode })
      })
      modesContainer.appendChild(btn)
      this.modeButtons.push(btn)
    }

    // Stop button
    this.shadow.querySelector('.stop-btn')!.addEventListener('click', (e) => {
      e.stopPropagation()
      chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' })
    })

    // Header click = toggle collapse
    const header = this.shadow.querySelector('.header')!
    header.addEventListener('click', (e) => {
      if (this.isDragging) return
      this.toggleCollapse()
    })

    // Drag
    header.addEventListener('mousedown', (e: Event) => {
      const me = e as MouseEvent
      this.isDragging = false
      this.dragOffsetX = me.clientX - this.card.getBoundingClientRect().left
      this.dragOffsetY = me.clientY - this.card.getBoundingClientRect().top

      const onMove = (ev: MouseEvent) => {
        this.isDragging = true
        const x = ev.clientX - this.dragOffsetX
        const y = ev.clientY - this.dragOffsetY
        this.card.style.left = `${x}px`
        this.card.style.top = `${y}px`
        this.card.style.right = 'auto'
        this.card.style.bottom = 'auto'
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        // Save position
        if (this.isDragging) {
          const rect = this.card.getBoundingClientRect()
          chrome.storage.local.set({
            'pointdev_float_pos': { left: rect.left, top: rect.top },
          })
        }
        setTimeout(() => { this.isDragging = false }, 0)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })

    // Restore position, clamped to current viewport
    chrome.storage.local.get('pointdev_float_pos').then((data) => {
      const pos = data['pointdev_float_pos']
      if (pos) {
        const maxLeft = window.innerWidth - 280
        const maxTop = window.innerHeight - 100
        const left = Math.max(0, Math.min(pos.left, maxLeft))
        const top = Math.max(0, Math.min(pos.top, maxTop))
        this.card.style.left = `${left}px`
        this.card.style.top = `${top}px`
        this.card.style.right = 'auto'
        this.card.style.bottom = 'auto'
      }
    }).catch(() => {})

    this.updateStats(0, 0)
  }

  show(captureStartedAt: number): void {
    this.startTime = captureStartedAt
    document.body.appendChild(this.host)
    this.timerId = window.setInterval(() => this.updateTimer(), 1000)
    this.updateTimer()
  }

  destroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }
    this.host.remove()
  }

  getHostElement(): HTMLElement {
    return this.host
  }

  setMode(mode: CaptureMode): void {
    this.currentMode = mode
    this.modeButtons.forEach((btn, i) => {
      btn.className = `mode-btn${MODES[i].mode === mode ? ' active' : ''}`
    })
  }

  updateStats(annotationCount: number, screenshotCount: number): void {
    this.statsEl.textContent = ''

    const mic = document.createElement('span')
    mic.textContent = '\uD83C\uDF99 Active'
    this.statsEl.appendChild(mic)

    const ann = document.createElement('span')
    ann.textContent = `${annotationCount} ann.`
    this.statsEl.appendChild(ann)

    const ss = document.createElement('span')
    ss.textContent = `${screenshotCount} screenshots`
    this.statsEl.appendChild(ss)
  }

  updateTranscript(text: string): void {
    if (text) {
      // Clear and rebuild safely
      this.transcriptEl.textContent = ''
      const icon = document.createElement('span')
      icon.className = 'transcript-icon'
      icon.textContent = '\uD83C\uDF99'
      this.transcriptEl.appendChild(icon)
      this.transcriptEl.appendChild(document.createTextNode(` "${text.slice(-50)}"`))
    }
  }

  private toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed
    this.card.classList.toggle('collapsed', this.isCollapsed)
  }

  private updateTimer(): void {
    const elapsed = Date.now() - this.startTime
    const m = Math.floor(elapsed / 60000)
    const s = Math.floor((elapsed % 60000) / 1000)
    this.timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
}
