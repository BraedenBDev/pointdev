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
      console.log('[PointDev] tabs.query result:', JSON.stringify(tabs.map(t => ({ id: t.id, url: t.url?.slice(0, 50) }))))
      const tab = tabs[0]
      if (!tab?.id || !tab.url) {
        console.error('[PointDev] No active tab found')
        return { type: 'CAPTURE_ERROR', error: 'No active tab found' }
      }

      // Content script is declaratively injected via manifest content_scripts.
      // Send PING to verify it's ready.
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'PING' })
        console.log('[PointDev] Content script responded to PING')
      } catch (e) {
        console.error('[PointDev] Content script not responding:', e)
        return { type: 'CAPTURE_ERROR', error: 'Content script not loaded. Try reloading the page.' }
      }

      const session = store.startSession(
        tab.id,
        tab.url,
        tab.title || '',
        { width: tab.width || 1200, height: tab.height || 800 }
      )

      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'INJECT_CAPTURE', tabId: tab.id })
        console.log('[PointDev] INJECT_CAPTURE sent successfully')
      } catch (e) {
        console.error('[PointDev] INJECT_CAPTURE failed:', e)
        return { type: 'CAPTURE_ERROR', error: 'Failed to start capture on this page.' }
      }
      return { type: 'SESSION_UPDATED', session }
    }

    case 'STOP_CAPTURE': {
      const session = store.getSession()
      if (!session) return { type: 'CAPTURE_ERROR', error: 'No active capture session' }

      // Remove overlay from the page
      try {
        await chrome.tabs.sendMessage(session.tabId, { type: 'REMOVE_CAPTURE' }).catch(() => {})
      } catch {
        // Content script may already be gone
      }

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
        const { selector, rect, timestampMs } = message.data
        const screenshot = {
          selector,
          timestampMs,
          dataUrl,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
        store.addScreenshot(screenshot)
        return { type: 'SCREENSHOT_CAPTURED', data: screenshot }
      } catch {
        // Screenshot capture failed, continue without it
        return undefined
      }
    }

    default:
      return undefined
  }
}
