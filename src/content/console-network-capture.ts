import type { ConsoleEntry, FailedRequest } from '@shared/types'

type BatchCallback = (entries: ConsoleEntry[], requests: FailedRequest[]) => void

export class ConsoleNetworkCapture {
  private captureStartedAt: number
  private onBatch: BatchCallback
  private listener: ((e: Event) => void) | null = null

  constructor(captureStartedAt: number, onBatch: BatchCallback) {
    this.captureStartedAt = captureStartedAt
    this.onBatch = onBatch
  }

  start(): void {
    this.listener = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.entries || detail?.requests) {
        this.onBatch(detail.entries || [], detail.requests || [])
      }
    }
    document.addEventListener('pointdev-console-batch', this.listener)
  }

  stop(): void {
    if (this.listener) {
      document.removeEventListener('pointdev-console-batch', this.listener)
      this.listener = null
    }
    // Signal main-world script to stop
    document.dispatchEvent(new CustomEvent('pointdev-console-stop'))
  }
}

// NOTE: The main-world capture script is inlined in message-handler.ts as an argument
// to chrome.scripting.executeScript({ world: 'MAIN', func: ... }). It cannot be imported
// from this module because it runs in a different JS world. See message-handler.ts START_CAPTURE.
//
// The following is a REFERENCE COPY for documentation/testing purposes only — it is not
// called at runtime. The canonical version is the inline function in message-handler.ts.
export function mainWorldCaptureScript(captureStartedAt: number): void {
  const origConsoleError = console.error
  const origConsoleWarn = console.warn
  const origFetch = window.fetch
  const origXHRSend = XMLHttpRequest.prototype.send

  const entries: Array<{ level: string; message: string; stack?: string; timestampMs: number }> = []
  const requests: Array<{ method: string; url: string; status: number; statusText: string; timestampMs: number }> = []

  function ts() { return Date.now() - captureStartedAt }

  console.error = function (...args: any[]) {
    const msg = args.map(a => typeof a === 'string' ? a : String(a)).join(' ')
    const stack = new Error().stack?.split('\n').slice(2, 5).join('\n')
    entries.push({ level: 'error', message: msg.slice(0, 500), stack, timestampMs: ts() })
    return origConsoleError.apply(console, args)
  }

  console.warn = function (...args: any[]) {
    const msg = args.map(a => typeof a === 'string' ? a : String(a)).join(' ')
    entries.push({ level: 'warn', message: msg.slice(0, 500), timestampMs: ts() })
    return origConsoleWarn.apply(console, args)
  }

  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const method = init?.method || 'GET'
    const url = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).slice(0, 200)
    return origFetch.apply(window, [input, init as any]).then(
      (response: Response) => {
        if (!response.ok) {
          requests.push({ method, url, status: response.status, statusText: response.statusText, timestampMs: ts() })
        }
        return response
      },
      (err: Error) => {
        requests.push({ method, url, status: 0, statusText: err.message || 'Network error', timestampMs: ts() })
        throw err
      }
    )
  } as typeof fetch

  const origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
    (this as any).__pd_method = method;
    (this as any).__pd_url = String(url).slice(0, 200)
    return origOpen.apply(this, [method, url, ...rest] as any)
  }

  XMLHttpRequest.prototype.send = function (...args: any[]) {
    this.addEventListener('loadend', () => {
      if (this.status >= 400 || this.status === 0) {
        requests.push({
          method: (this as any).__pd_method || 'GET',
          url: (this as any).__pd_url || '',
          status: this.status,
          statusText: this.statusText || (this.status === 0 ? 'Network error' : ''),
          timestampMs: ts(),
        })
      }
    })
    return origXHRSend.apply(this, args)
  }

  window.addEventListener('error', (event) => {
    entries.push({
      level: 'error',
      message: (event.message || 'Uncaught error').slice(0, 500),
      stack: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      timestampMs: ts(),
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || event.reason?.toString() || 'Unhandled promise rejection'
    entries.push({
      level: 'error',
      message: msg.slice(0, 500),
      stack: event.reason?.stack?.split('\n').slice(0, 3).join('\n'),
      timestampMs: ts(),
    })
  })

  // Flush every 500ms
  const interval = setInterval(() => {
    if (entries.length > 0 || requests.length > 0) {
      document.dispatchEvent(new CustomEvent('pointdev-console-batch', {
        detail: { entries: entries.splice(0), requests: requests.splice(0) },
      }))
    }
  }, 500)

  // Listen for stop signal
  document.addEventListener('pointdev-console-stop', () => {
    console.error = origConsoleError
    console.warn = origConsoleWarn
    window.fetch = origFetch
    XMLHttpRequest.prototype.open = origOpen
    XMLHttpRequest.prototype.send = origXHRSend
    clearInterval(interval)
    // Final flush
    if (entries.length > 0 || requests.length > 0) {
      document.dispatchEvent(new CustomEvent('pointdev-console-batch', {
        detail: { entries: entries.splice(0), requests: requests.splice(0) },
      }))
    }
  }, { once: true })
}
