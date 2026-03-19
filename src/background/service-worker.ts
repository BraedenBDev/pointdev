import { SessionStore } from './session-store'
import { handleMessage } from './message-handler'

const store = new SessionStore()

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

chrome.runtime.onInstalled.addListener(() => {
  console.log('PointDev installed')
})

// Restore session on worker restart
store.restore()

// Message handler — only return true for types this context handles
const HANDLED_TYPES = new Set([
  'START_CAPTURE', 'STOP_CAPTURE', 'SET_MODE',
  'TRANSCRIPT_UPDATE', 'ELEMENT_SELECTED', 'ANNOTATION_ADDED',
  'CURSOR_BATCH', 'DEVICE_METADATA', 'SCREENSHOT_REQUEST',
  'CONSOLE_BATCH',
])

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!HANDLED_TYPES.has(message.type)) return false
  handleMessage(message, store).then(response => {
    if (response) sendResponse(response)
  })
  return true // async response
})

// Keep-alive via port connection from sidepanel
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'pointdev-keepalive') {
    port.onDisconnect.addListener(() => {
      console.log('Sidepanel disconnected')
    })
  }
})
