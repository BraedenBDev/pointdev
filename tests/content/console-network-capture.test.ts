import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsoleNetworkCapture } from '../../src/content/console-network-capture'

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn(),
    },
  })
})

describe('ConsoleNetworkCapture', () => {
  it('attaches DOM event listener on start', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const onBatch = vi.fn()
    const capture = new ConsoleNetworkCapture(Date.now(), onBatch)
    capture.start()

    expect(addSpy).toHaveBeenCalledWith('pointdev-console-batch', expect.any(Function))
    capture.stop()
    addSpy.mockRestore()
  })

  it('removes DOM event listener on stop', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const onBatch = vi.fn()
    const capture = new ConsoleNetworkCapture(Date.now(), onBatch)
    capture.start()
    capture.stop()

    expect(removeSpy).toHaveBeenCalledWith('pointdev-console-batch', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('calls onBatch when receiving CustomEvent', () => {
    const onBatch = vi.fn()
    const capture = new ConsoleNetworkCapture(Date.now(), onBatch)
    capture.start()

    const event = new CustomEvent('pointdev-console-batch', {
      detail: {
        entries: [{ level: 'error', message: 'test error', timestampMs: 500 }],
        requests: [{ method: 'GET', url: '/api/test', status: 404, statusText: 'Not Found', timestampMs: 600 }],
      },
    })
    document.dispatchEvent(event)

    expect(onBatch).toHaveBeenCalledWith(
      [{ level: 'error', message: 'test error', timestampMs: 500 }],
      [{ method: 'GET', url: '/api/test', status: 404, statusText: 'Not Found', timestampMs: 600 }],
    )

    capture.stop()
  })
})
