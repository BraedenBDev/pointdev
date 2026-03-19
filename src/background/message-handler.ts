import type { Message } from '@shared/messages'
import type { SessionStore } from './session-store'

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

      // Inject console/network capture into the page's main world
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN' as any,
          func: (startedAt: number) => {
            // Inline the main-world capture logic
            // (imported version can't cross the world boundary)
            const origError = console.error, origWarn = console.warn
            const origFetch = window.fetch, origOpen = XMLHttpRequest.prototype.open
            const origSend = XMLHttpRequest.prototype.send
            const entries: any[] = [], requests: any[] = []
            const ts = () => Date.now() - startedAt

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
            window.addEventListener('error', (e) => { entries.push({ level: 'error', message: (e.message || 'Uncaught error').slice(0, 500), stack: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined, timestampMs: ts() }) })
            window.addEventListener('unhandledrejection', (e) => { entries.push({ level: 'error', message: (e.reason?.message || String(e.reason)).slice(0, 500), stack: e.reason?.stack?.split('\n').slice(0, 3).join('\n'), timestampMs: ts() }) })
            const iv = setInterval(() => { if (entries.length || requests.length) document.dispatchEvent(new CustomEvent('pointdev-console-batch', { detail: { entries: entries.splice(0), requests: requests.splice(0) } })) }, 500)
            document.addEventListener('pointdev-console-stop', () => { console.error = origError; console.warn = origWarn; window.fetch = origFetch; XMLHttpRequest.prototype.open = origOpen; XMLHttpRequest.prototype.send = origSend; clearInterval(iv); if (entries.length || requests.length) document.dispatchEvent(new CustomEvent('pointdev-console-batch', { detail: { entries: entries.splice(0), requests: requests.splice(0) } })) }, { once: true })
          },
          args: [Date.now()],
        })
      } catch {
        // Main-world injection failed (e.g., chrome:// pages) — continue without it
      }

      return { type: 'SESSION_UPDATED', session }
    }

    case 'STOP_CAPTURE': {
      const session = store.getSession()
      if (!session) return { type: 'CAPTURE_ERROR', error: 'No active capture session' }

      // Remove overlay from the page (content script may already be gone)
      await chrome.tabs.sendMessage(session.tabId, { type: 'REMOVE_CAPTURE' }).catch(() => {})

      const finalSession = store.endSession()!
      return { type: 'CAPTURE_COMPLETE', session: finalSession }
    }

    case 'SET_MODE': {
      const s = store.getSession()
      if (s) {
        await chrome.tabs.sendMessage(s.tabId, { type: 'MODE_CHANGED', mode: message.mode }).catch(() => {})
      }
      return undefined
    }

    case 'TRANSCRIPT_UPDATE': {
      store.updateTranscript(message.data.transcript, message.data.segment)
      const session = store.getSession()
      return session ? { type: 'SESSION_UPDATED', session } : undefined
    }

    case 'ELEMENT_SELECTED': {
      store.setSelectedElement(message.data)
      const session = store.getSession()
      return session ? { type: 'SESSION_UPDATED', session } : undefined
    }

    case 'ANNOTATION_ADDED': {
      store.addAnnotation(message.data)
      const session = store.getSession()
      return session ? { type: 'SESSION_UPDATED', session } : undefined
    }

    case 'CURSOR_BATCH': {
      store.addCursorBatch(message.data)
      return undefined
    }

    case 'DEVICE_METADATA': {
      store.setDeviceMetadata(message.data)
      return undefined
    }

    case 'SCREENSHOT_REQUEST': {
      const session = store.getSession()
      if (!session) return undefined

      try {
        const dataUrl = await chrome.tabs.captureVisibleTab()
        const { timestampMs, viewport, annotationIndex, selectedElementSelector, replacesPrevious } = message.data

        // Build description parts
        const annotationIndices: number[] = []
        const descParts: string[] = []

        if (annotationIndex != null) {
          // -1 sentinel means "the annotation that was just added"
          const resolvedIndex = annotationIndex === -1 ? session.annotations.length - 1 : annotationIndex
          if (resolvedIndex >= 0 && resolvedIndex < session.annotations.length) {
            annotationIndices.push(resolvedIndex)
            const ann = session.annotations[resolvedIndex]
            if (ann) {
              const target = ann.nearestElement || 'unknown element'
              const label = ann.type.charAt(0).toUpperCase() + ann.type.slice(1)
              descParts.push(`${label} around ${target}`)
            }
          }
        }

        if (selectedElementSelector) {
          descParts.push(`Selected ${selectedElementSelector}`)
        }

        // Find overlapping voice context (±2s window, join multiple segments)
        let voiceContext: string | undefined
        if (session.voiceRecording) {
          const overlapping = session.voiceRecording.segments.filter(seg =>
            seg.startMs <= timestampMs + 2000 && seg.endMs >= timestampMs - 2000
          )
          if (overlapping.length > 0) {
            voiceContext = overlapping.map(s => s.text).join(' ')
          }
        }

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
        return updated ? { type: 'SESSION_UPDATED', session: updated } : undefined
      } catch {
        // captureVisibleTab failed (e.g., chrome:// pages)
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
