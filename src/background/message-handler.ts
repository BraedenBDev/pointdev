import type { Message } from '@shared/messages'
import type { AnnotationData, CaptureSession, CursorSampleData, VoiceSegment } from '@shared/types'
import { distance } from '@shared/dwell'
import type { SessionStore } from './session-store'

/** Broadcast SESSION_UPDATED to all extension contexts (sidepanel, etc.)
 *  sendResponse only goes to the original sender — this ensures the sidepanel
 *  receives live updates during capture. */
function broadcastSessionUpdate(session: CaptureSession): void {
  chrome.runtime.sendMessage({ type: 'SESSION_UPDATED', session }).catch(() => {})
}

/** Resolve annotation index and build description parts for a screenshot. */
function buildAnnotationDesc(
  annotations: AnnotationData[],
  annotationIndex: number | undefined,
  selectedElementSelector: string | undefined,
): { annotationIndices: number[]; descParts: string[] } {
  const annotationIndices: number[] = []
  const descParts: string[] = []

  if (annotationIndex != null) {
    const resolved = annotationIndex === -1 ? annotations.length - 1 : annotationIndex
    if (resolved >= 0 && resolved < annotations.length) {
      annotationIndices.push(resolved)
      const ann = annotations[resolved]
      if (ann) {
        const label = ann.type.charAt(0).toUpperCase() + ann.type.slice(1)
        descParts.push(`${label} around ${ann.nearestElement || 'unknown element'}`)
      }
    }
  }

  if (selectedElementSelector) {
    descParts.push(`Selected ${selectedElementSelector}`)
  }

  return { annotationIndices, descParts }
}

/** Find voice segments overlapping a ±2s window around a timestamp. */
function findOverlappingVoice(segments: VoiceSegment[], timestampMs: number): string | undefined {
  const overlapping = segments.filter(seg =>
    seg.startMs <= timestampMs + 2000 && seg.endMs >= timestampMs - 2000
  )
  return overlapping.length > 0 ? overlapping.map(s => s.text).join(' ') : undefined
}

export async function handleMessage(
  message: Message,
  store: SessionStore
): Promise<any> {
  switch (message.type) {
    case 'START_CAPTURE': {
      console.log('[PointDev] START_CAPTURE received')
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
      const tab = tabs[0]
      if (!tab?.id) {
        console.error('[PointDev] No active tab found')
        return { type: 'CAPTURE_ERROR', error: 'No active tab found' }
      }
      // activeTab doesn't populate url in tabs.query — get it via tabs.get
      const fullTab = await chrome.tabs.get(tab.id)
      console.log('[PointDev] Tab:', fullTab.id, fullTab.url?.slice(0, 60))

      // Content script is declaratively injected via manifest content_scripts.
      // Send PING to verify it's ready. If not, inject programmatically and retry.
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'PING' })
        console.log('[PointDev] Content script responded to PING')
      } catch {
        console.log('[PointDev] Content script not present, injecting programmatically')
        try {
          const manifest = chrome.runtime.getManifest()
          const contentScriptFiles = manifest.content_scripts?.[0]?.js ?? []
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: contentScriptFiles,
          })
        } catch (injectErr) {
          console.error('[PointDev] Failed to inject content script:', injectErr)
          return { type: 'CAPTURE_ERROR', error: 'Cannot capture on this page. Try reloading.' }
        }
        // Wait briefly for the script to initialize, then retry PING
        await new Promise(r => setTimeout(r, 200))
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'PING' })
          console.log('[PointDev] Content script responded after injection')
        } catch {
          return { type: 'CAPTURE_ERROR', error: 'Content script failed to start. Try reloading the page.' }
        }
      }

      // Send INJECT_CAPTURE and get page info from content script response
      let pageInfo: any
      try {
        pageInfo = await chrome.tabs.sendMessage(tab.id, { type: 'INJECT_CAPTURE', tabId: tab.id })
        console.log('[PointDev] INJECT_CAPTURE response:', JSON.stringify(pageInfo))
      } catch (e) {
        console.error('[PointDev] INJECT_CAPTURE failed:', e)
        return { type: 'CAPTURE_ERROR', error: 'Failed to start capture on this page.' }
      }

      const session = store.startSession(
        tab.id,
        pageInfo?.url || fullTab.url || '',
        pageInfo?.title || fullTab.title || '',
        pageInfo?.viewport || { width: fullTab.width || 1200, height: fullTab.height || 800 }
      )

      // Reset dwell detector for new session
      resetDwellDetector()

      // Voice recognition runs in the sidepanel (stays open during capture)
      // Offscreen doc approach disabled — Chrome doesn't transfer mic permission to offscreen contexts

      // Inject console/network capture into the page's main world
      // Generate a random nonce so malicious pages can't poison the IPC channel
      const nonce = Math.random().toString(36).slice(2, 10)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN' as any,
          func: (startedAt: number, nonce: string) => {
            // Inline the main-world capture logic
            // (imported version can't cross the world boundary)
            const origError = console.error, origWarn = console.warn
            const origFetch = window.fetch, origOpen = XMLHttpRequest.prototype.open
            const origSend = XMLHttpRequest.prototype.send
            const entries: any[] = [], requests: any[] = []
            const ts = () => Date.now() - startedAt
            const batchEvent = `pointdev-console-batch-${nonce}`
            const stopEvent = `pointdev-console-stop-${nonce}`

            console.error = function(...a: any[]) {
              entries.push({ level: 'error', message: a.map(String).join(' ').slice(0, 500), stack: new Error().stack?.split('\n').slice(2, 5).join('\n'), timestampMs: ts() })
              return origError.apply(console, a)
            }
            console.warn = function(...a: any[]) {
              entries.push({ level: 'warn', message: a.map(String).join(' ').slice(0, 500), timestampMs: ts() })
              return origWarn.apply(console, a)
            }
            window.fetch = function(input: any, init?: any) {
              const m = init?.method || 'GET', u = String(typeof input === 'string' ? input : input?.url || input).slice(0, 200)
              return origFetch.apply(window, [input, init]).then(
                (r: any) => { if (!r.ok) requests.push({ method: m, url: u, status: r.status, statusText: r.statusText, timestampMs: ts() }); return r },
                (e: any) => { requests.push({ method: m, url: u, status: 0, statusText: e.message || 'Network error', timestampMs: ts() }); throw e }
              )
            } as any
            XMLHttpRequest.prototype.open = function(m: string, u: any, ...r: any[]) { (this as any).__pd_m = m; (this as any).__pd_u = String(u).slice(0, 200); return origOpen.apply(this, [m, u, ...r] as any) }
            XMLHttpRequest.prototype.send = function(...a: any[]) {
              this.addEventListener('loadend', () => { if (this.status >= 400 || this.status === 0) requests.push({ method: (this as any).__pd_m || 'GET', url: (this as any).__pd_u || '', status: this.status, statusText: this.statusText || '', timestampMs: ts() }) })
              return origSend.apply(this, a)
            }
            const onError = (e: ErrorEvent) => { entries.push({ level: 'error', message: (e.message || 'Uncaught error').slice(0, 500), stack: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined, timestampMs: ts() }) }
            const onRejection = (e: PromiseRejectionEvent) => { entries.push({ level: 'error', message: (e.reason?.message || String(e.reason)).slice(0, 500), stack: e.reason?.stack?.split('\n').slice(0, 3).join('\n'), timestampMs: ts() }) }
            window.addEventListener('error', onError)
            window.addEventListener('unhandledrejection', onRejection)
            const iv = setInterval(() => { if (entries.length || requests.length) document.dispatchEvent(new CustomEvent(batchEvent, { detail: { entries: entries.splice(0), requests: requests.splice(0) } })) }, 500)
            document.addEventListener(stopEvent, () => { console.error = origError; console.warn = origWarn; window.fetch = origFetch; XMLHttpRequest.prototype.open = origOpen; XMLHttpRequest.prototype.send = origSend; clearInterval(iv); window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); if (entries.length || requests.length) document.dispatchEvent(new CustomEvent(batchEvent, { detail: { entries: entries.splice(0), requests: requests.splice(0) } })) }, { once: true })
          },
          args: [Date.now(), nonce],
        })
        // Send nonce to content script so it can listen on the correct channel
        chrome.tabs.sendMessage(tab.id, { type: 'SET_CONSOLE_NONCE', nonce }).catch(() => {})
      } catch {
        // Main-world injection failed (e.g., chrome:// pages) — continue without it
      }

      return { type: 'SESSION_UPDATED', session }
    }

    case 'STOP_CAPTURE': {
      const session = store.getSession()
      if (!session) return { type: 'CAPTURE_ERROR', error: 'No active capture session' }

      // Voice is stopped by the sidepanel (App.tsx handleStop calls speech.stop())

      // Remove overlay from the page (content script may already be gone)
      await chrome.tabs.sendMessage(session.tabId, { type: 'REMOVE_CAPTURE' }).catch(() => {})

      resetDwellDetector()
      const finalSession = store.endSession()!
      console.log('[PointDev] CAPTURE_COMPLETE: screenshots=', finalSession.screenshots.length, 'annotations=', finalSession.annotations.length)

      // Store completed session so sidepanel can pick it up when it reopens
      try {
        await chrome.storage.session.set({ completedSession: finalSession })
      } catch {}

      // Broadcast so sidepanel knows capture ended (e.g. when floating card triggers stop)
      chrome.runtime.sendMessage({ type: 'CAPTURE_COMPLETE', session: finalSession }).catch(() => {})

      // Reopen sidepanel with results
      try {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
        if (tabs[0]?.windowId) {
          await (chrome.sidePanel as any).open({ windowId: tabs[0].windowId })
        }
      } catch {
        // sidePanel.open() may require user gesture in some contexts
      }

      return { type: 'CAPTURE_COMPLETE', session: finalSession }
    }

    case 'SET_MODE': {
      const session = store.getSession()
      if (session) {
        await chrome.tabs.sendMessage(session.tabId, { type: 'MODE_CHANGED', mode: message.mode }).catch(() => {})
      }
      return undefined
    }

    case 'TRANSCRIPT_UPDATE': {
      store.updateTranscript(message.data.transcript, message.data.segment)
      const session = store.getSession()
      // Forward transcript snippet to floating card
      if (session) {
        chrome.tabs.sendMessage(session.tabId, {
          type: 'TRANSCRIPT_SNIPPET',
          text: message.data.segment.text,
        }).catch(() => {})
      }
      if (session) broadcastSessionUpdate(session)
      return session ? { type: 'SESSION_UPDATED', session } : undefined
    }

    case 'ELEMENT_SELECTED': {
      store.setSelectedElement(message.data)
      const session = store.getSession()
      if (session) broadcastSessionUpdate(session)
      return session ? { type: 'SESSION_UPDATED', session } : undefined
    }

    case 'ANNOTATION_ADDED': {
      store.addAnnotation(message.data)
      const session = store.getSession()
      if (session) {
        chrome.tabs.sendMessage(session.tabId, {
          type: 'SESSION_STATS',
          annotationCount: session.annotations.length,
          screenshotCount: session.screenshots.length,
        }).catch(() => {})
        broadcastSessionUpdate(session)
      }
      return session ? { type: 'SESSION_UPDATED', session } : undefined
    }

    case 'CURSOR_BATCH': {
      store.addCursorBatch(message.data)

      if (store.hasSession()) {
        const dwellUpdate = detectRealtimeDwell(message.data)
        if (dwellUpdate) {
          chrome.runtime.sendMessage({
            type: 'DWELL_UPDATE',
            data: dwellUpdate,
          }).catch(() => {})
        }
      }
      return undefined
    }

    case 'DEVICE_METADATA': {
      store.setDeviceMetadata(message.data)
      return undefined
    }

    case 'SCREENSHOT_REQUEST': {
      const session = store.getSession()
      if (!session) {
        console.log('[PointDev] SCREENSHOT_REQUEST: no active session')
        return undefined
      }

      try {
        console.log('[PointDev] SCREENSHOT_REQUEST: calling captureVisibleTab')
        const dataUrl = await chrome.tabs.captureVisibleTab()
        console.log('[PointDev] SCREENSHOT_REQUEST: captured', dataUrl.length, 'chars')
        const { timestampMs, viewport, annotationIndex, selectedElementSelector, replacesPrevious } = message.data

        const { annotationIndices, descParts } = buildAnnotationDesc(
          session.annotations, annotationIndex, selectedElementSelector
        )

        const voiceContext = session.voiceRecording
          ? findOverlappingVoice(session.voiceRecording.segments, timestampMs)
          : undefined

        const screenshot = {
          dataUrl,
          timestampMs,
          viewport,
          annotationIndices,
          descriptionParts: descParts.length > 0 ? descParts : ['Page capture'],
          voiceContext,
        }

        if (replacesPrevious) {
          store.updateLastScreenshot(screenshot)
        } else {
          store.addAnnotatedScreenshot(screenshot)
        }

        const updated = store.getSession()
        if (updated) {
          chrome.tabs.sendMessage(updated.tabId, {
            type: 'SESSION_STATS',
            annotationCount: updated.annotations.length,
            screenshotCount: updated.screenshots.length,
          }).catch(() => {})
          broadcastSessionUpdate(updated)
        }
        return updated ? { type: 'SESSION_UPDATED', session: updated } : undefined
      } catch (err) {
        console.error('[PointDev] SCREENSHOT_REQUEST failed:', err)
        return undefined
      }
    }

    case 'SNAPSHOT_REQUEST': {
      if (!store.hasSession()) return undefined
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab({
          format: 'jpeg',
          quality: 30,
        })
        return { dataUrl }
      } catch {
        return undefined
      }
    }

    case 'SMART_SCREENSHOT_REQUEST': {
      const session = store.getSession()
      if (!session) return undefined

      try {
        const dataUrl = await chrome.tabs.captureVisibleTab()
        const { trigger, interestScore, frameDiffRatio, dwellElement, dwellDurationMs, voiceSegment, annotationIndex, selectedElementSelector } = message.data
        const timestampMs = Date.now() - session.startedAt

        const { annotationIndices, descParts } = buildAnnotationDesc(
          session.annotations, annotationIndex, selectedElementSelector
        )

        // Describe why this was captured
        if (trigger === 'frame-diff') descParts.push('Visual change detected')
        if (trigger === 'voice') descParts.push('Voice narration active')
        if (trigger === 'dwell' && dwellElement) descParts.push(`Dwell on ${dwellElement}`)
        if (trigger === 'multi') descParts.push('Multiple signals')

        const voiceContext = voiceSegment
          || (session.voiceRecording ? findOverlappingVoice(session.voiceRecording.segments, timestampMs) : undefined)

        const screenshot = {
          dataUrl,
          timestampMs,
          viewport: { scrollX: 0, scrollY: 0 },
          annotationIndices,
          descriptionParts: descParts.length > 0 ? descParts : ['Auto-captured'],
          voiceContext,
          trigger,
          interestScore,
          signals: { frameDiffRatio, dwellElement, dwellDurationMs, voiceSegment },
        }

        store.addAnnotatedScreenshot(screenshot)
        const updated = store.getSession()
        if (updated) {
          chrome.tabs.sendMessage(updated.tabId, {
            type: 'SESSION_STATS',
            annotationCount: updated.annotations.length,
            screenshotCount: updated.screenshots.length,
          }).catch(() => {})
          broadcastSessionUpdate(updated)
        }
        return updated ? { type: 'SESSION_UPDATED', session: updated } : undefined
      } catch (err) {
        console.error('[PointDev] SMART_SCREENSHOT_REQUEST failed:', err)
        return undefined
      }
    }

    case 'CONSOLE_BATCH': {
      store.addConsoleBatch(message.data.entries, message.data.requests)
      return undefined
    }


    default:
      return undefined
  }
}

// --- Real-time dwell detection ---
// Uses a lower threshold (800ms) than full dwell analysis (1000ms) for early signaling.
const DWELL_EARLY_MS = 800
let dwellAnchor: { x: number; y: number; startMs: number; element?: string } | null = null
let lastDwellActive = false

function resetDwellDetector(): void {
  dwellAnchor = null
  lastDwellActive = false
}

function detectRealtimeDwell(
  samples: CursorSampleData[]
): { element: string; durationMs: number; active: boolean } | null {
  if (!samples.length) return null

  // Scan all samples in the batch to catch motion + stop within a single batch
  let result: { element: string; durationMs: number; active: boolean } | null = null

  for (const sample of samples) {
    if (!dwellAnchor) {
      dwellAnchor = { x: sample.x, y: sample.y, startMs: sample.timestampMs, element: sample.nearestElement }
      continue
    }

    const dist = distance(
      { x: sample.x, y: sample.y, timestampMs: sample.timestampMs },
      { x: dwellAnchor.x, y: dwellAnchor.y, timestampMs: dwellAnchor.startMs }
    )

    if (dist > 30) {
      // Cursor moved away — reset anchor, end any active dwell
      dwellAnchor = { x: sample.x, y: sample.y, startMs: sample.timestampMs, element: sample.nearestElement }
      if (lastDwellActive) {
        lastDwellActive = false
        result = { element: '', durationMs: 0, active: false }
      }
      continue
    }

    const elapsed = sample.timestampMs - dwellAnchor.startMs
    if (elapsed >= DWELL_EARLY_MS && !lastDwellActive) {
      lastDwellActive = true
      result = { element: dwellAnchor.element || '', durationMs: elapsed, active: true }
    } else if (elapsed >= DWELL_EARLY_MS && lastDwellActive) {
      // Update duration for ongoing dwell
      result = { element: dwellAnchor.element || '', durationMs: elapsed, active: true }
    }
  }

  return result
}
