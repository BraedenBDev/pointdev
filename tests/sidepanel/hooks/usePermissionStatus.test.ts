import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePermissionStatus } from '../../../src/sidepanel/hooks/usePermissionStatus'

// Mock chrome APIs
const mockChrome = {
  tabs: {
    query: vi.fn(),
    get: vi.fn(),
    onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: {
    sendMessage: vi.fn(),
    getURL: vi.fn((path: string) => `chrome-extension://id/${path}`),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}

vi.stubGlobal('chrome', mockChrome)

// Mock navigator.permissions
Object.defineProperty(navigator, 'permissions', {
  value: { query: vi.fn() },
  writable: true,
  configurable: true,
})

const mockPermissions = navigator.permissions as unknown as { query: ReturnType<typeof vi.fn> }

describe('usePermissionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPermissions.query.mockResolvedValue({ state: 'granted' })
    mockChrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
    mockChrome.tabs.get.mockResolvedValue({ id: 1, url: 'https://example.com' })
    mockChrome.runtime.sendMessage.mockResolvedValue({ type: 'PONG' })
  })

  it('returns all 4 permission rows', async () => {
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(4)
    })
    const names = result.current.permissions.map(p => p.name)
    expect(names).toEqual(['Microphone', 'Active Tab', 'Scripting', 'Service Worker'])
  })

  it('reports canCapture true when tab is accessible', async () => {
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.canCapture).toBe(true)
    })
  })

  it('reports canCapture false on chrome:// pages', async () => {
    mockChrome.tabs.query.mockResolvedValue([{ id: 2, url: 'chrome://extensions' }])
    mockChrome.tabs.get.mockResolvedValue({ id: 2, url: 'chrome://extensions' })
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(4)
      expect(result.current.canCapture).toBe(false)
      const tabRow = result.current.permissions.find(p => p.name === 'Active Tab')
      expect(tabRow?.status).toBe('error')
      expect(tabRow?.label).toBe('Restricted')
    })
  })

  it('reports mic denied when permission query returns denied', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'denied' })
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(4)
    })
    const micRow = result.current.permissions.find(p => p.name === 'Microphone')
    expect(micRow?.status).toBe('error')
    expect(micRow?.action).toBe('Setup')
  })

  it('reports mic granted when permission query returns granted', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'granted' })
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(4)
    })
    const micRow = result.current.permissions.find(p => p.name === 'Microphone')
    expect(micRow?.status).toBe('ok')
    expect(micRow?.label).toBe('Granted')
    expect(micRow?.action).toBeUndefined()
  })

  it('reports scripting blocked when tab is restricted', async () => {
    mockChrome.tabs.query.mockResolvedValue([{ url: 'chrome-extension://abc/popup.html' }])
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(4)
    })
    const scriptRow = result.current.permissions.find(p => p.name === 'Scripting')
    expect(scriptRow?.status).toBe('error')
    expect(scriptRow?.label).toBe('Blocked')
  })

  it('reports service worker inactive when sendMessage throws', async () => {
    mockChrome.runtime.sendMessage.mockRejectedValue(new Error('SW not available'))
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(4)
    })
    const swRow = result.current.permissions.find(p => p.name === 'Service Worker')
    expect(swRow?.status).toBe('error')
    expect(swRow?.label).toBe('Inactive')
  })


  it('reports canCapture false when tabs.query throws', async () => {
    mockChrome.tabs.query.mockRejectedValue(new Error('tabs API unavailable'))
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(4)
    })
    expect(result.current.canCapture).toBe(false)
    const tabRow = result.current.permissions.find(p => p.name === 'Active Tab')
    expect(tabRow?.status).toBe('error')
  })

  it('reports canCapture false on about: pages', async () => {
    mockChrome.tabs.query.mockResolvedValue([{ url: 'about:blank' }])
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.canCapture).toBe(false)
    })
  })

  it('provides requestMicPermission callback', async () => {
    const { result } = renderHook(() => usePermissionStatus())
    expect(typeof result.current.requestMicPermission).toBe('function')
  })

  it('opens the mic-permission tab when the side panel cannot prompt', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')) },
      configurable: true,
    })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const { result } = renderHook(() => usePermissionStatus())
    await result.current.requestMicPermission()
    expect(open).toHaveBeenCalledWith('chrome-extension://id/mic-permission.html')
  })

  it('re-checks the active tab when the user switches tabs', async () => {
    mockChrome.tabs.get.mockResolvedValue({ id: 1, url: 'chrome-extension://id/mic-permission.html' })
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => expect(result.current.permissions).toHaveLength(4))
    expect(result.current.canCapture).toBe(false)

    mockChrome.tabs.get.mockResolvedValue({ id: 2, url: 'https://example.com' })
    const onActivated = mockChrome.tabs.onActivated.addListener.mock.calls.at(-1)![0]
    onActivated()
    await waitFor(() => expect(result.current.canCapture).toBe(true))
  })
})
