import { useState, useEffect, useCallback } from 'react'

export interface PermissionStatus {
  name: string
  status: 'ok' | 'error'
  label: string
  action?: string
  onAction?: () => void
}

export function usePermissionStatus() {
  const [permissions, setPermissions] = useState<PermissionStatus[]>([])
  const [canCapture, setCanCapture] = useState(false)
  const [micGranted, setMicGranted] = useState(false)

  const requestMicPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      setMicGranted(true)
    } catch {
      // Side panels can't show the permission prompt — grant it from a tab instead
      window.open(chrome.runtime.getURL('mic-permission.html'))
    }
  }, [])

  // mic-permission.html broadcasts this once the user allows access
  useEffect(() => {
    const listener = (message: { type?: string }) => {
      if (message.type === 'MIC_PERMISSION_GRANTED') setMicGranted(true)
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  useEffect(() => {
    async function check() {
      const results: PermissionStatus[] = []

      // Microphone
      let micOk = micGranted
      if (!micOk) {
        try {
          const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          micOk = perm.state === 'granted'
          setMicGranted(micOk)
        } catch {
          // permissions.query not available
        }
      }
      results.push({
        name: 'Microphone',
        status: micOk ? 'ok' : 'error',
        label: micOk ? 'Granted' : 'Denied',
        ...(micOk ? {} : { action: 'Setup' }),
      })

      // Active Tab — check if current tab is capturable
      // activeTab doesn't populate url in tabs.query — use tabs.get for the full object
      let tabOk = false
      try {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
        const tab = tabs[0]
        if (tab?.id) {
          const fullTab = await chrome.tabs.get(tab.id)
          const url = fullTab.url || ''
          if (url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://') && !url.startsWith('about:')) {
            tabOk = true
          } else if (!url) {
            // URL not available — assume capturable (will fail gracefully if not)
            tabOk = true
          }
        }
      } catch {
        // tabs API not available
      }
      results.push({
        name: 'Active Tab',
        status: tabOk ? 'ok' : 'error',
        label: tabOk ? 'Ready' : 'Restricted',
      })

      // Scripting — same as active tab (if tab is restricted, scripting is blocked)
      results.push({
        name: 'Scripting',
        status: tabOk ? 'ok' : 'error',
        label: tabOk ? 'Allowed' : 'Blocked',
      })


      // Service Worker — check if it's active
      let swOk = false
      try {
        await chrome.runtime.sendMessage({ type: 'PING' })
        swOk = true
      } catch {
        // SW not responding
      }
      results.push({
        name: 'Service Worker',
        status: swOk ? 'ok' : 'error',
        label: swOk ? 'Active' : 'Inactive',
      })

      setPermissions(results)
      setCanCapture(tabOk) // Can capture if tab is accessible (mic optional)
    }

    check()
    // Re-check when the user switches tabs or navigates — the status is per-tab
    const onUpdated = (_id: number, info: chrome.tabs.TabChangeInfo) => {
      if (info.url || info.status === 'complete') check()
    }
    chrome.tabs.onActivated.addListener(check)
    chrome.tabs.onUpdated.addListener(onUpdated)
    return () => {
      chrome.tabs.onActivated.removeListener(check)
      chrome.tabs.onUpdated.removeListener(onUpdated)
    }
  }, [micGranted])

  return { permissions, canCapture, micGranted, requestMicPermission }
}
