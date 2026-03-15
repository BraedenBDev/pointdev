import { SessionStore } from './session-store'
import { handleMessage } from './message-handler'

const store = new SessionStore()

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

chrome.runtime.onInstalled.addListener(() => {
  console.log('PointDev installed')
})

// Restore session on worker restart
store.restore()

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
