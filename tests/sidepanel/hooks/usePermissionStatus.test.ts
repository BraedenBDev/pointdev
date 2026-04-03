import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePermissionStatus } from '../../../src/sidepanel/hooks/usePermissionStatus'

// Mock chrome APIs
const mockChrome = {
  tabs: {
    query: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn(),
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
    mockChrome.tabs.query.mockResolvedValue([{ url: 'https://example.com' }])
    mockChrome.runtime.sendMessage.mockResolvedValue({ type: 'PONG' })
  })

  it('returns all 5 permission rows', async () => {
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(5)
    })
    const names = result.current.permissions.map(p => p.name)
    expect(names).toEqual(['Microphone', 'Active Tab', 'Scripting', 'Offscreen Doc', 'Service Worker'])
  })

  it('reports canCapture true when tab is accessible', async () => {
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.canCapture).toBe(true)
    })
  })

  it('reports canCapture false on chrome:// pages', async () => {
    mockChrome.tabs.query.mockResolvedValue([{ url: 'chrome://extensions' }])
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(5)
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
      expect(result.current.permissions).toHaveLength(5)
    })
    const micRow = result.current.permissions.find(p => p.name === 'Microphone')
    expect(micRow?.status).toBe('error')
    expect(micRow?.action).toBe('Setup')
  })

  it('reports mic granted when permission query returns granted', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'granted' })
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(5)
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
      expect(result.current.permissions).toHaveLength(5)
    })
    const scriptRow = result.current.permissions.find(p => p.name === 'Scripting')
    expect(scriptRow?.status).toBe('error')
    expect(scriptRow?.label).toBe('Blocked')
  })

  it('reports service worker inactive when sendMessage throws', async () => {
    mockChrome.runtime.sendMessage.mockRejectedValue(new Error('SW not available'))
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(5)
    })
    const swRow = result.current.permissions.find(p => p.name === 'Service Worker')
    expect(swRow?.status).toBe('error')
    expect(swRow?.label).toBe('Inactive')
  })

  it('always reports offscreen doc as available', async () => {
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(5)
    })
    const offscreenRow = result.current.permissions.find(p => p.name === 'Offscreen Doc')
    expect(offscreenRow?.status).toBe('ok')
    expect(offscreenRow?.label).toBe('Available')
  })

  it('reports canCapture false when tabs.query throws', async () => {
    mockChrome.tabs.query.mockRejectedValue(new Error('tabs API unavailable'))
    const { result } = renderHook(() => usePermissionStatus())
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(5)
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
})
