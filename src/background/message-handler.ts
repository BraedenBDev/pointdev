import type { Message } from '@shared/messages'
import type { SessionStore } from './session-store'

export async function handleMessage(
  message: Message,
  store: SessionStore
): Promise<any> {
  switch (message.type) {
    case 'START_CAPTURE': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url) {
        return { type: 'CAPTURE_ERROR', error: 'No active tab found' }
      }

      // Inject content script (with PING guard)
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'PING' })
        // Content script already present
      } catch {
        // Not present, inject
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/index.js'],
          })
        } catch (e) {
          return { type: 'CAPTURE_ERROR', error: 'Cannot capture on this page.' }
        }
      }

      const session = store.startSession(
        tab.id,
        tab.url,
        tab.title || '',
        { width: tab.width || 1200, height: tab.height || 800 }
      )

      await chrome.tabs.sendMessage(tab.id, { type: 'INJECT_CAPTURE', tabId: tab.id })
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
      // No SESSION_UPDATED for cursor batches (too noisy)
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
