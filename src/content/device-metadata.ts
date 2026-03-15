import type { DeviceMetadata } from '@shared/types'

export function parseBrowser(ua: string): { name: string; version: string } {
  // Order matters: Edge contains "Chrome", so check Edge first
  const edgeMatch = ua.match(/Edg\/(\S+)/)
  if (edgeMatch) return { name: 'Edge', version: edgeMatch[1] }

  const firefoxMatch = ua.match(/Firefox\/(\S+)/)
  if (firefoxMatch) return { name: 'Firefox', version: firefoxMatch[1] }

  const chromeMatch = ua.match(/Chrome\/(\S+)/)
  if (chromeMatch) return { name: 'Chrome', version: chromeMatch[1] }

  const safariMatch = ua.match(/Version\/(\S+).*Safari/)
  if (safariMatch) return { name: 'Safari', version: safariMatch[1] }

  return { name: 'Unknown', version: '' }
}

export function collectDeviceMetadata(win: Window): DeviceMetadata {
  const ua = win.navigator.userAgent

  let colorScheme: 'light' | 'dark' | 'unknown' = 'unknown'
  if (win.matchMedia('(prefers-color-scheme: dark)').matches) {
    colorScheme = 'dark'
  } else if (win.matchMedia('(prefers-color-scheme: light)').matches) {
    colorScheme = 'light'
  }

  return {
    userAgent: ua,
    browser: parseBrowser(ua),
    os: win.navigator.platform,
    language: win.navigator.language,
    screen: {
      width: win.screen.width,
      height: win.screen.height,
    },
    window: {
      innerWidth: win.innerWidth,
      innerHeight: win.innerHeight,
      outerWidth: win.outerWidth,
      outerHeight: win.outerHeight,
    },
    devicePixelRatio: win.devicePixelRatio,
    touchSupport: win.navigator.maxTouchPoints > 0,
    colorScheme,
  }
}
