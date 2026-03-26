# P1 Implementation Plan: Output Formats → Bridge Server → Local STT

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three P1 features in dependency order — JSON/Markdown export (#10), MCP bridge server (#12), and local speech-to-text via Whisper WASM (#7).

**Architecture:** Each feature is an independent subsystem that builds on the previous. JSON export provides structured data that the bridge server exposes via MCP, and local STT replaces the Web Speech API backend while keeping the same `VoiceSegment` interface.

**Tech Stack:** TypeScript, React 18, Chrome MV3, Vitest, `@anthropic-ai/sdk` (MCP), `whisper.cpp` (WASM), bun

---

## Part 1: Pluggable Output Formats (#10)

### File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/shared/formatter.ts` | Modify | Add `formatSessionJSON()` and `formatSessionMarkdown()` alongside existing `formatSession()` |
| `src/shared/types.ts` | Modify | Add `OutputFormat` type |
| `src/sidepanel/components/OutputView.tsx` | Modify | Add format selector dropdown + "Copy as JSON" / "Copy as Markdown" buttons |
| `src/sidepanel/components/CopyButton.tsx` | Modify | Accept optional `label` prop |
| `tests/shared/formatter-json.test.ts` | Create | Tests for JSON export |
| `tests/shared/formatter-markdown.test.ts` | Create | Tests for Markdown export |

---

### Task 1: JSON Session Formatter

**Files:**
- Create: `tests/shared/formatter-json.test.ts`
- Modify: `src/shared/formatter.ts`
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add OutputFormat type**

In `src/shared/types.ts`, add at the end (before `createEmptySession`):

```typescript
export type OutputFormat = 'text' | 'json' | 'markdown'
```

- [ ] **Step 2: Write the failing tests**

Create `tests/shared/formatter-json.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatSessionJSON } from '../../src/shared/formatter'
import { createEmptySession } from '../../src/shared/types'
import type { CaptureSession } from '../../src/shared/types'

function makeSession(overrides: Partial<CaptureSession> = {}): CaptureSession {
  return {
    ...createEmptySession('test-1', 1, 'https://example.com', 'Test Page', { width: 1440, height: 900 }),
    ...overrides,
  }
}

describe('formatSessionJSON', () => {
  it('returns valid JSON string', () => {
    const session = makeSession()
    const result = formatSessionJSON(session)
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('includes context fields', () => {
    const session = makeSession()
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.context.url).toBe('https://example.com')
    expect(parsed.context.title).toBe('Test Page')
    expect(parsed.context.viewport).toEqual({ width: 1440, height: 900 })
  })

  it('includes voice segments', () => {
    const session = makeSession({
      voiceRecording: {
        transcript: 'hello world',
        durationMs: 5000,
        segments: [
          { text: 'hello', startMs: 1000, endMs: 2000 },
          { text: 'world', startMs: 3000, endMs: 4000 },
        ],
      },
    })
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.voice.segments).toHaveLength(2)
    expect(parsed.voice.segments[0].text).toBe('hello')
    expect(parsed.voice.transcript).toBe('hello world')
  })

  it('includes annotations with coordinates', () => {
    const session = makeSession({
      annotations: [{
        type: 'circle',
        coordinates: { centerX: 100, centerY: 200, radiusX: 50, radiusY: 50 },
        timestampMs: 5000,
        nearestElement: '.btn',
      }],
    })
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.annotations).toHaveLength(1)
    expect(parsed.annotations[0].type).toBe('circle')
    expect(parsed.annotations[0].nearestElement).toBe('.btn')
  })

  it('includes screenshots without dataUrl (too large for clipboard)', () => {
    const session = makeSession({
      screenshots: [{
        dataUrl: 'data:image/jpeg;base64,verylongstring',
        timestampMs: 3000,
        viewport: { scrollX: 0, scrollY: 0 },
        annotationIndices: [],
        descriptionParts: ['Voice narration active'],
        voiceContext: 'this is broken',
        trigger: 'voice',
        interestScore: 0.7,
        signals: { frameDiffRatio: 0.12, voiceSegment: 'this is broken' },
      }],
    })
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.screenshots).toHaveLength(1)
    expect(parsed.screenshots[0].dataUrl).toBeUndefined()
    expect(parsed.screenshots[0].trigger).toBe('voice')
    expect(parsed.screenshots[0].voiceContext).toBe('this is broken')
  })

  it('includes cursor dwells (collapsed)', () => {
    const session = makeSession({
      cursorTrace: [
        { x: 100, y: 100, timestampMs: 0, nearestElement: '.nav', dwellMs: 3000 },
        { x: 100, y: 100, timestampMs: 3000, nearestElement: '.nav', dwellMs: 3000 },
      ],
    })
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.cursor.dwells.length).toBeGreaterThan(0)
    expect(parsed.cursor.dwells[0].element).toBe('.nav')
  })

  it('includes console errors and failed requests', () => {
    const session = makeSession({
      consoleErrors: [{ level: 'error', message: 'TypeError', timestampMs: 1000 }],
      failedRequests: [{ method: 'GET', url: '/api/data', status: 500, statusText: 'Internal Server Error', timestampMs: 2000 }],
    })
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.console.errors).toHaveLength(1)
    expect(parsed.console.failedRequests).toHaveLength(1)
  })

  it('omits empty sections', () => {
    const session = makeSession()
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.voice).toBeUndefined()
    expect(parsed.annotations).toBeUndefined()
    expect(parsed.cursor).toBeUndefined()
    expect(parsed.console).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bunx vitest run tests/shared/formatter-json.test.ts`
Expected: FAIL — `formatSessionJSON` is not exported

- [ ] **Step 4: Implement formatSessionJSON**

Add to `src/shared/formatter.ts`:

```typescript
import { computeDwells, collapseDwells } from './dwell'

export function formatSessionJSON(session: CaptureSession): string {
  const collapsed = collapseDwells(computeDwells(session.cursorTrace))
  const dwells = collapsed
    .filter(s => s.dwellMs != null && s.dwellMs > 0)
    .map(s => ({
      element: s.nearestElement || 'unknown',
      x: s.x,
      y: s.y,
      durationMs: s.dwellMs!,
      timestampMs: s.timestampMs,
    }))

  const result: Record<string, any> = {
    context: {
      url: session.url,
      title: session.title,
      viewport: session.viewport,
      capturedAt: new Date(session.startedAt).toISOString(),
    },
  }

  if (session.device) {
    result.device = session.device
  }

  if (session.selectedElement) {
    result.selectedElement = {
      selector: session.selectedElement.selector,
      computedStyles: session.selectedElement.computedStyles,
      boxModel: session.selectedElement.boxModel,
      domSubtree: session.selectedElement.domSubtree,
      reactComponent: session.selectedElement.reactComponent,
      cssVariables: session.selectedElement.cssVariables,
    }
  }

  if (session.voiceRecording && session.voiceRecording.segments.length > 0) {
    result.voice = {
      transcript: session.voiceRecording.transcript,
      durationMs: session.voiceRecording.durationMs,
      segments: session.voiceRecording.segments,
    }
  }

  if (session.annotations.length > 0) {
    result.annotations = session.annotations.map(a => ({
      type: a.type,
      coordinates: a.coordinates,
      timestampMs: a.timestampMs,
      nearestElement: a.nearestElement,
      nearestElementContext: a.nearestElementContext ? {
        computedStyles: a.nearestElementContext.computedStyles,
        boxModel: a.nearestElementContext.boxModel,
        domSubtree: a.nearestElementContext.domSubtree,
      } : undefined,
    }))
  }

  if (dwells.length > 0) {
    result.cursor = { dwells }
  }

  if (session.screenshots.length > 0) {
    result.screenshots = session.screenshots.map(s => ({
      timestampMs: s.timestampMs,
      viewport: s.viewport,
      descriptionParts: s.descriptionParts,
      voiceContext: s.voiceContext,
      trigger: s.trigger,
      interestScore: s.interestScore,
      signals: s.signals,
      // dataUrl omitted — too large for clipboard/JSON export
    }))
  }

  if (session.consoleErrors.length > 0 || session.failedRequests.length > 0) {
    result.console = {}
    if (session.consoleErrors.length > 0) result.console.errors = session.consoleErrors
    if (session.failedRequests.length > 0) result.console.failedRequests = session.failedRequests
  }

  return JSON.stringify(result, null, 2)
}
```

Also add the import for `computeDwells` and `collapseDwells` at the top of `formatter.ts`:

```typescript
import { computeDwells, collapseDwells } from './dwell'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run tests/shared/formatter-json.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared/formatter.ts src/shared/types.ts tests/shared/formatter-json.test.ts
git commit -m "feat(#10): add JSON session export with formatSessionJSON"
```

---

### Task 2: Markdown Session Formatter

**Files:**
- Create: `tests/shared/formatter-markdown.test.ts`
- Modify: `src/shared/formatter.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/shared/formatter-markdown.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatSessionMarkdown } from '../../src/shared/formatter'
import { createEmptySession } from '../../src/shared/types'

describe('formatSessionMarkdown', () => {
  it('starts with H1 title', () => {
    const session = createEmptySession('test', 1, 'https://example.com', 'Test', { width: 1440, height: 900 })
    const md = formatSessionMarkdown(session)
    expect(md).toMatch(/^# PointDev Capture/)
  })

  it('wraps existing formatSession output with markdown frontmatter', () => {
    const session = createEmptySession('test', 1, 'https://example.com', 'Test', { width: 1440, height: 900 })
    const md = formatSessionMarkdown(session)
    expect(md).toContain('## Context')
    expect(md).toContain('https://example.com')
  })

  it('includes screenshot references as image placeholders', () => {
    const session = {
      ...createEmptySession('test', 1, 'https://example.com', 'Test', { width: 1440, height: 900 }),
      screenshots: [{
        dataUrl: 'data:image/jpeg;base64,abc',
        timestampMs: 3000,
        viewport: { scrollX: 0, scrollY: 0 },
        annotationIndices: [],
        descriptionParts: ['Auto-captured'],
        trigger: 'voice' as const,
        interestScore: 0.7,
      }],
    }
    const md = formatSessionMarkdown(session)
    expect(md).toContain('![Screenshot 1]')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/shared/formatter-markdown.test.ts`
Expected: FAIL — `formatSessionMarkdown` is not exported

- [ ] **Step 3: Implement formatSessionMarkdown**

Add to `src/shared/formatter.ts`:

```typescript
export function formatSessionMarkdown(session: CaptureSession): string {
  const sessionWithDwells = {
    ...session,
    cursorTrace: collapseDwells(computeDwells(session.cursorTrace)),
  }

  const header = `# PointDev Capture — ${session.title}\n\n` +
    `> Captured from [${session.url}](${session.url}) on ${new Date(session.startedAt).toISOString().replace('T', ' ').slice(0, 19)}\n`

  const body = formatSession(sessionWithDwells)

  let screenshotSection = ''
  if (session.screenshots.length > 0) {
    const lines = ['\n---\n\n## Screenshot Attachments\n']
    for (let i = 0; i < session.screenshots.length; i++) {
      const s = session.screenshots[i]
      const ts = formatTimestamp(s.timestampMs)
      const desc = s.descriptionParts.join(' | ')
      lines.push(`![Screenshot ${i + 1}](screenshot-${i + 1}.jpg)`)
      lines.push(`*[${ts}] ${desc}*\n`)
    }
    screenshotSection = lines.join('\n')
  }

  return header + '\n' + body + screenshotSection
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run tests/shared/formatter-markdown.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/formatter.ts tests/shared/formatter-markdown.test.ts
git commit -m "feat(#10): add Markdown session export with formatSessionMarkdown"
```

---

### Task 3: Output Format Selector in UI

**Files:**
- Modify: `src/sidepanel/components/OutputView.tsx`
- Modify: `src/sidepanel/components/CopyButton.tsx`

- [ ] **Step 1: Update CopyButton to accept a label prop**

In `src/sidepanel/components/CopyButton.tsx`, change the interface and button text:

```typescript
interface CopyButtonProps {
  text: string
  label?: string
}

export function CopyButton({ text, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <div>
      <button className="btn-copy" onClick={handleCopy}>
        {copied ? 'Copied!' : (label || 'Copy to Clipboard')}
      </button>
      {copied && <div className="copied-feedback">Paste into your AI coding tool</div>}
    </div>
  )
}
```

- [ ] **Step 2: Update OutputView with format selector**

Replace `src/sidepanel/components/OutputView.tsx`:

```typescript
import { useMemo, useState } from 'react'
import type { CaptureSession } from '@shared/types'
import type { OutputFormat } from '@shared/types'
import { formatSession, formatSessionJSON, formatSessionMarkdown } from '@shared/formatter'
import { computeDwells, collapseDwells } from '@shared/dwell'
import { CopyButton } from './CopyButton'
import { ScreenshotThumbnail } from './ScreenshotThumbnail'

interface OutputViewProps {
  session: CaptureSession
  onBack: () => void
}

export function OutputView({ session, onBack }: OutputViewProps) {
  const [format, setFormat] = useState<OutputFormat>('text')

  const output = useMemo(() => {
    const sessionWithDwells = {
      ...session,
      cursorTrace: collapseDwells(computeDwells(session.cursorTrace)),
    }
    switch (format) {
      case 'json': return formatSessionJSON(sessionWithDwells)
      case 'markdown': return formatSessionMarkdown(sessionWithDwells)
      default: return formatSession(sessionWithDwells)
    }
  }, [session, format])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span className="header">PointDev</span>
        <button className="btn-back" onClick={onBack}>&#8592; Back</button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['text', 'json', 'markdown'] as OutputFormat[]).map(f => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            style={{
              padding: '3px 10px', fontSize: 11, borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', cursor: 'pointer',
              background: format === f ? 'var(--accent)' : 'var(--code-bg)',
              color: format === f ? '#fff' : 'var(--fg)',
            }}
          >
            {f === 'text' ? 'Text' : f === 'json' ? 'JSON' : 'Markdown'}
          </button>
        ))}
      </div>

      <div className="output-view">{output}</div>
      {session.screenshots.length > 0 && (
        <div style={{ marginTop: 12, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Screenshots</div>
          {session.screenshots.map((ss, i) => (
            <ScreenshotThumbnail key={i} screenshot={ss} size="large" />
          ))}
        </div>
      )}
      <CopyButton text={output} label={`Copy ${format === 'text' ? '' : format.toUpperCase() + ' '}to Clipboard`} />
    </div>
  )
}
```

- [ ] **Step 3: Run full test suite**

Run: `bunx vitest run`
Expected: All tests PASS (784 existing + new formatter tests)

- [ ] **Step 4: Manual test — load extension, capture session, switch between formats**

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/components/OutputView.tsx src/sidepanel/components/CopyButton.tsx
git commit -m "feat(#10): add format selector UI — text, JSON, markdown"
```

---

## Part 2: Bridge Server (#12)

### File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `bridge/package.json` | Create | npm package `@pointdev/bridge` |
| `bridge/src/server.ts` | Create | WebSocket server receiving session data from extension |
| `bridge/src/mcp.ts` | Create | MCP server exposing PointDev tools |
| `bridge/src/index.ts` | Create | Entry point — starts both servers |
| `bridge/tsconfig.json` | Create | TypeScript config for bridge package |
| `src/shared/messages.ts` | Modify | Add `BRIDGE_SESSION_PUSH` message type |
| `src/sidepanel/hooks/useCaptureSession.ts` | Modify | Push session data to bridge on capture complete |
| `tests/bridge/server.test.ts` | Create | WebSocket server tests |
| `tests/bridge/mcp.test.ts` | Create | MCP tool tests |

---

### Task 4: Bridge Server — WebSocket Receiver

**Files:**
- Create: `bridge/package.json`
- Create: `bridge/tsconfig.json`
- Create: `bridge/src/server.ts`
- Create: `tests/bridge/server.test.ts`

- [ ] **Step 1: Initialize bridge package**

Create `bridge/package.json`:

```json
{
  "name": "@pointdev/bridge",
  "version": "0.1.0",
  "description": "PointDev bridge server — connects the Chrome extension to AI coding tools via MCP",
  "type": "module",
  "bin": {
    "pointdev-bridge": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.13",
    "tsx": "^4.19.0",
    "typescript": "^5.9.3"
  }
}
```

Create `bridge/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/bridge/server.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BridgeServer } from '../../bridge/src/server'

describe('BridgeServer', () => {
  let server: BridgeServer

  beforeEach(() => {
    server = new BridgeServer(0) // port 0 = random available port
  })

  afterEach(async () => {
    await server.stop()
  })

  it('starts and stops without error', async () => {
    await server.start()
    expect(server.port).toBeGreaterThan(0)
    await server.stop()
  })

  it('stores session data received via pushSession', () => {
    const session = { id: 'test', url: 'https://example.com' }
    server.pushSession(session as any)
    expect(server.currentSession).toEqual(session)
  })

  it('returns null when no session is stored', () => {
    expect(server.currentSession).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bunx vitest run tests/bridge/server.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement BridgeServer**

Create `bridge/src/server.ts`:

```typescript
import { WebSocketServer, WebSocket } from 'ws'
import type { AddressInfo } from 'net'

export class BridgeServer {
  private wss: WebSocketServer | null = null
  private _currentSession: any = null
  private _port: number

  constructor(port = 3456) {
    this._port = port
  }

  get port(): number {
    if (this.wss) {
      return (this.wss.address() as AddressInfo).port
    }
    return this._port
  }

  get currentSession(): any {
    return this._currentSession
  }

  pushSession(session: any): void {
    this._currentSession = session
    // Broadcast to connected clients
    if (this.wss) {
      const msg = JSON.stringify({ type: 'session_updated', session })
      for (const client of this.wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg)
        }
      }
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this._port }, () => {
        console.log(`[PointDev Bridge] WebSocket server listening on port ${this.port}`)
        resolve()
      })

      this.wss.on('connection', (ws) => {
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString())
            if (msg.type === 'push_session') {
              this.pushSession(msg.session)
            }
          } catch {
            // Ignore malformed messages
          }
        })
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => resolve())
        this.wss = null
      } else {
        resolve()
      }
    })
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run tests/bridge/server.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add bridge/ tests/bridge/server.test.ts
git commit -m "feat(#12): add WebSocket bridge server for session data"
```

---

### Task 5: Bridge Server — MCP Tools

**Files:**
- Create: `bridge/src/mcp.ts`
- Create: `bridge/src/index.ts`
- Create: `tests/bridge/mcp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/bridge/mcp.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildMcpToolHandlers } from '../../bridge/src/mcp'

describe('MCP tool handlers', () => {
  it('get_session returns null when no session exists', () => {
    const handlers = buildMcpToolHandlers(() => null)
    const result = handlers.get_session()
    expect(result).toEqual({ content: [{ type: 'text', text: 'No active capture session.' }] })
  })

  it('get_session returns session JSON when session exists', () => {
    const session = { id: 'test', url: 'https://example.com', title: 'Test' }
    const handlers = buildMcpToolHandlers(() => session)
    const result = handlers.get_session()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.url).toBe('https://example.com')
  })

  it('get_voice_transcript returns segments', () => {
    const session = {
      voiceRecording: {
        transcript: 'hello world',
        segments: [{ text: 'hello', startMs: 0, endMs: 1000 }],
      },
    }
    const handlers = buildMcpToolHandlers(() => session)
    const result = handlers.get_voice_transcript()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.segments).toHaveLength(1)
  })

  it('get_annotations returns annotation list', () => {
    const session = {
      annotations: [{ type: 'circle', nearestElement: '.btn', timestampMs: 5000 }],
    }
    const handlers = buildMcpToolHandlers(() => session)
    const result = handlers.get_annotations()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/bridge/mcp.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement MCP tool handlers**

Create `bridge/src/mcp.ts`:

```typescript
type GetSession = () => any | null

interface ToolResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>
}

export function buildMcpToolHandlers(getSession: GetSession) {
  return {
    get_session(): ToolResult {
      const session = getSession()
      if (!session) {
        return { content: [{ type: 'text', text: 'No active capture session.' }] }
      }
      const { screenshots, ...rest } = session
      const withoutDataUrls = {
        ...rest,
        screenshots: (screenshots || []).map((s: any) => {
          const { dataUrl, ...meta } = s
          return meta
        }),
      }
      return { content: [{ type: 'text', text: JSON.stringify(withoutDataUrls, null, 2) }] }
    },

    get_voice_transcript(): ToolResult {
      const session = getSession()
      if (!session?.voiceRecording) {
        return { content: [{ type: 'text', text: 'No voice recording in this session.' }] }
      }
      return { content: [{ type: 'text', text: JSON.stringify(session.voiceRecording, null, 2) }] }
    },

    get_annotations(): ToolResult {
      const session = getSession()
      if (!session?.annotations?.length) {
        return { content: [{ type: 'text', text: 'No annotations in this session.' }] }
      }
      return { content: [{ type: 'text', text: JSON.stringify(session.annotations, null, 2) }] }
    },

    get_screenshot(args: { index: number }): ToolResult {
      const session = getSession()
      if (!session?.screenshots?.[args.index]) {
        return { content: [{ type: 'text', text: `Screenshot ${args.index} not found.` }] }
      }
      const screenshot = session.screenshots[args.index]
      if (!screenshot.dataUrl) {
        return { content: [{ type: 'text', text: 'Screenshot image data not available.' }] }
      }
      const base64 = screenshot.dataUrl.split(',')[1]
      return {
        content: [
          { type: 'image', data: base64, mimeType: 'image/png' },
          { type: 'text', text: JSON.stringify({
            timestampMs: screenshot.timestampMs,
            trigger: screenshot.trigger,
            voiceContext: screenshot.voiceContext,
            descriptionParts: screenshot.descriptionParts,
          }, null, 2) },
        ],
      }
    },
  }
}
```

- [ ] **Step 4: Create entry point**

Create `bridge/src/index.ts`:

```typescript
#!/usr/bin/env node
import { BridgeServer } from './server.js'
import { buildMcpToolHandlers } from './mcp.js'

const PORT = parseInt(process.env.POINTDEV_PORT || '3456', 10)

async function main() {
  const server = new BridgeServer(PORT)
  await server.start()

  const handlers = buildMcpToolHandlers(() => server.currentSession)

  // MCP stdio server will be wired here in future
  // For now, expose handlers for testing
  console.log('[PointDev Bridge] Ready. Waiting for session data from extension...')
  console.log('[PointDev Bridge] MCP tools: get_session, get_voice_transcript, get_annotations, get_screenshot')

  process.on('SIGINT', async () => {
    await server.stop()
    process.exit(0)
  })
}

main().catch(console.error)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run tests/bridge/mcp.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add bridge/src/mcp.ts bridge/src/index.ts tests/bridge/mcp.test.ts
git commit -m "feat(#12): add MCP tool handlers for session, voice, annotations, screenshots"
```

---

### Task 6: Extension → Bridge Push on Capture Complete

**Files:**
- Modify: `src/sidepanel/hooks/useCaptureSession.ts`
- Modify: `src/sidepanel/components/OutputView.tsx`

- [ ] **Step 1: Add bridge push to stopCapture**

In `src/sidepanel/hooks/useCaptureSession.ts`, add a function that pushes the session to the bridge WebSocket when capture completes:

```typescript
// At module level, above the hook function
function pushToBridge(session: CaptureSession): void {
  try {
    const ws = new WebSocket('ws://localhost:3456')
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'push_session', session }))
      ws.close()
    }
    ws.onerror = () => {} // Bridge not running — silent fail
  } catch {
    // WebSocket not available — silent fail
  }
}
```

Then in the `stopCapture` callback, after setting the session:

```typescript
const stopCapture = useCallback(async () => {
  if (intelligenceRef.current) {
    intelligenceRef.current.stop()
    intelligenceRef.current = null
  }

  const response = await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' })
  if (response?.type === 'CAPTURE_COMPLETE') {
    setSession(response.session)
    setState('complete')
    pushToBridge(response.session)  // ← add this line
  }
  portRef.current?.disconnect()
  portRef.current = null
}, [])
```

- [ ] **Step 2: Add bridge status indicator to OutputView**

In `src/sidepanel/components/OutputView.tsx`, add a small status indicator below the copy button:

```typescript
// After CopyButton, add:
<div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
  Tip: Run <code>npx @pointdev/bridge</code> to stream sessions to AI tools via MCP
</div>
```

- [ ] **Step 3: Run full test suite**

Run: `bunx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/hooks/useCaptureSession.ts src/sidepanel/components/OutputView.tsx
git commit -m "feat(#12): push session to bridge server on capture complete"
```

---

## Part 3: Local Speech-to-Text (#7)

### File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/sidepanel/whisper-worker.ts` | Create | Web Worker running whisper.cpp WASM inference |
| `src/sidepanel/hooks/useWhisperRecognition.ts` | Create | Hook wrapping Whisper worker, same interface as useSpeechRecognition |
| `src/sidepanel/hooks/useSpeechRecognition.ts` | Modify | Accept `engine` parameter to switch between Web Speech and Whisper |
| `src/sidepanel/App.tsx` | Modify | Add engine toggle UI |
| `tests/sidepanel/hooks/useWhisperRecognition.test.ts` | Create | Unit tests for the Whisper hook |

### Dependencies

```bash
# In the extension package, not the bridge
bun add @anthropic-ai/sdk  # only if needed for types
```

The Whisper WASM binary and model files are loaded from a CDN or bundled — no npm dependency. The whisper.cpp project provides pre-built WASM at `https://whisper.ggerganov.com/`.

---

### Task 7: Whisper Web Worker

**Files:**
- Create: `src/sidepanel/whisper-worker.ts`

- [ ] **Step 1: Create the worker interface**

Create `src/sidepanel/whisper-worker.ts`:

```typescript
// Messages from main thread → worker
interface WorkerInMessage {
  type: 'init' | 'process_audio'
  modelUrl?: string      // for 'init'
  audioData?: Float32Array // for 'process_audio'
  sampleRate?: number     // for 'process_audio'
}

// Messages from worker → main thread
interface WorkerOutMessage {
  type: 'ready' | 'progress' | 'transcript' | 'error'
  progress?: number       // 0-1 for model download
  text?: string           // transcribed text
  error?: string
}

// The worker loads whisper.cpp WASM and processes audio chunks
let whisperModule: any = null

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data

  if (msg.type === 'init') {
    try {
      // Load the whisper.cpp WASM module
      // This loads from the CDN — the model is cached by the browser
      const modelUrl = msg.modelUrl || 'https://whisper.ggerganov.com/ggml-model-whisper-tiny.en-q5_1.bin'

      self.postMessage({ type: 'progress', progress: 0 } as WorkerOutMessage)

      const response = await fetch(modelUrl)
      const reader = response.body!.getReader()
      const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10)
      let received = 0
      const chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        if (contentLength > 0) {
          self.postMessage({ type: 'progress', progress: received / contentLength } as WorkerOutMessage)
        }
      }

      const modelData = new Uint8Array(received)
      let offset = 0
      for (const chunk of chunks) {
        modelData.set(chunk, offset)
        offset += chunk.length
      }

      // Store model data for processing
      whisperModule = { modelData }
      self.postMessage({ type: 'ready' } as WorkerOutMessage)
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) } as WorkerOutMessage)
    }
  }

  if (msg.type === 'process_audio') {
    if (!whisperModule) {
      self.postMessage({ type: 'error', error: 'Model not loaded' } as WorkerOutMessage)
      return
    }

    try {
      // Placeholder: actual whisper.cpp WASM inference goes here
      // For now, this demonstrates the message interface
      // Real implementation requires compiling whisper.cpp to WASM
      // and calling the C API via Emscripten bindings
      self.postMessage({
        type: 'transcript',
        text: '[Whisper integration pending — WASM compilation required]',
      } as WorkerOutMessage)
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) } as WorkerOutMessage)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/sidepanel/whisper-worker.ts
git commit -m "feat(#7): add whisper worker interface for on-device STT"
```

---

### Task 8: Whisper Recognition Hook

**Files:**
- Create: `src/sidepanel/hooks/useWhisperRecognition.ts`
- Create: `tests/sidepanel/hooks/useWhisperRecognition.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/sidepanel/hooks/useWhisperRecognition.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

// Test the interface contract — the hook must return the same shape as useSpeechRecognition
describe('useWhisperRecognition interface', () => {
  it('exports a function', async () => {
    const mod = await import('../../../src/sidepanel/hooks/useWhisperRecognition')
    expect(typeof mod.useWhisperRecognition).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/sidepanel/hooks/useWhisperRecognition.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the hook**

Create `src/sidepanel/hooks/useWhisperRecognition.ts`:

```typescript
import { useState, useCallback, useRef } from 'react'
import type { VoiceSegment } from '@shared/types'

type WhisperState = 'idle' | 'downloading' | 'ready' | 'listening' | 'error'

interface UseWhisperRecognitionReturn {
  isAvailable: boolean
  isListening: boolean
  micPermission: 'checking' | 'granted' | 'needs-setup'
  transcript: string
  interimTranscript: string
  segments: VoiceSegment[]
  error: string | null
  modelState: WhisperState
  downloadProgress: number
  requestMicPermission: () => void
  start: (captureStartedAt: number) => void
  stop: () => void
}

export function useWhisperRecognition(): UseWhisperRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [micPermission, setMicPermission] = useState<'checking' | 'granted' | 'needs-setup'>('checking')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [segments, setSegments] = useState<VoiceSegment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [modelState, setModelState] = useState<WhisperState>('idle')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const workerRef = useRef<Worker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const captureStartRef = useRef(0)

  // Check mic permission on mount (same as Web Speech version)
  useState(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop())
        setMicPermission('granted')
      })
      .catch(() => setMicPermission('needs-setup'))
  })

  const requestMicPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      setMicPermission('granted')
    } catch {
      setError('Microphone access denied.')
    }
  }, [])

  const start = useCallback((captureStartedAt: number) => {
    if (micPermission !== 'granted') {
      setError('Microphone not enabled.')
      return
    }

    captureStartRef.current = captureStartedAt
    setTranscript('')
    setInterimTranscript('')
    setSegments([])
    setError(null)

    // Initialize worker
    const worker = new Worker(
      new URL('../whisper-worker.ts', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setModelState('downloading')
        setDownloadProgress(msg.progress)
      } else if (msg.type === 'ready') {
        setModelState('ready')
        startAudioCapture(worker)
      } else if (msg.type === 'transcript' && msg.text) {
        const now = Date.now()
        const segment: VoiceSegment = {
          text: msg.text,
          startMs: now - captureStartRef.current - 1000,
          endMs: now - captureStartRef.current,
        }
        setSegments(prev => {
          const updated = [...prev, segment]
          setTranscript(updated.map(s => s.text).join(' '))
          return updated
        })
      } else if (msg.type === 'error') {
        setError(msg.error)
        setModelState('error')
      }
    }

    workerRef.current = worker
    worker.postMessage({ type: 'init' })
    setModelState('downloading')
  }, [micPermission])

  const startAudioCapture = useCallback(async (worker: Worker) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
      })
      streamRef.current = stream
      setIsListening(true)
      setModelState('listening')

      // Process audio in chunks using AudioContext
      const audioContext = new AudioContext({ sampleRate: 16000 })
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)

      let audioBuffer: Float32Array[] = []
      const CHUNK_DURATION_MS = 3000
      let lastProcessTime = Date.now()

      processor.onaudioprocess = (e) => {
        const channelData = e.inputBuffer.getChannelData(0)
        audioBuffer.push(new Float32Array(channelData))

        if (Date.now() - lastProcessTime >= CHUNK_DURATION_MS) {
          // Concatenate buffer and send to worker
          const totalLength = audioBuffer.reduce((sum, b) => sum + b.length, 0)
          const combined = new Float32Array(totalLength)
          let offset = 0
          for (const buf of audioBuffer) {
            combined.set(buf, offset)
            offset += buf.length
          }

          worker.postMessage({
            type: 'process_audio',
            audioData: combined,
            sampleRate: 16000,
          }, [combined.buffer])

          audioBuffer = []
          lastProcessTime = Date.now()
          setInterimTranscript('Processing...')
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
    } catch (err) {
      setError('Failed to start audio capture: ' + String(err))
    }
  }, [])

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
    setIsListening(false)
    setInterimTranscript('')
    setModelState('idle')
  }, [])

  return {
    isAvailable: typeof Worker !== 'undefined',
    isListening,
    micPermission,
    transcript,
    interimTranscript,
    segments,
    error,
    modelState,
    downloadProgress,
    requestMicPermission,
    start,
    stop,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/sidepanel/hooks/useWhisperRecognition.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/hooks/useWhisperRecognition.ts tests/sidepanel/hooks/useWhisperRecognition.test.ts
git commit -m "feat(#7): add useWhisperRecognition hook for on-device STT"
```

---

### Task 9: Speech Engine Toggle in App

**Files:**
- Modify: `src/sidepanel/App.tsx`

- [ ] **Step 1: Add engine selection state and conditional hook usage**

In `src/sidepanel/App.tsx`, add a toggle between Web Speech and Whisper:

```typescript
import { useRef, useEffect, useState } from 'react'
import { useCaptureSession } from './hooks/useCaptureSession'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useWhisperRecognition } from './hooks/useWhisperRecognition'
// ... other imports

type SpeechEngine = 'web-speech' | 'whisper'

export function App() {
  const { state, session, error, startCapture, stopCapture, setMode, reset, setVoiceSignal } = useCaptureSession()
  const [engine, setEngine] = useState<SpeechEngine>('web-speech')
  const webSpeech = useSpeechRecognition()
  const whisper = useWhisperRecognition()
  const speech = engine === 'whisper' ? whisper : webSpeech
  const captureStartRef = useRef(0)

  // ... rest of the component stays the same, using `speech` variable
```

Add the engine toggle UI in the idle state, before the "Start Capture" button:

```typescript
{state === 'idle' && (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Speech engine:</div>
    <div style={{ display: 'flex', gap: 4 }}>
      <button
        onClick={() => setEngine('web-speech')}
        style={{
          padding: '3px 10px', fontSize: 11, borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', cursor: 'pointer',
          background: engine === 'web-speech' ? 'var(--accent)' : 'var(--code-bg)',
          color: engine === 'web-speech' ? '#fff' : 'var(--fg)',
        }}
      >
        Fast (Google)
      </button>
      <button
        onClick={() => setEngine('whisper')}
        style={{
          padding: '3px 10px', fontSize: 11, borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', cursor: 'pointer',
          background: engine === 'whisper' ? 'var(--accent)' : 'var(--code-bg)',
          color: engine === 'whisper' ? '#fff' : 'var(--fg)',
        }}
      >
        Private (On-device)
      </button>
    </div>
  </div>
)}
```

Show Whisper download progress during capture if applicable:

```typescript
{state === 'capturing' && engine === 'whisper' && whisper.modelState === 'downloading' && (
  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
    Downloading speech model... {Math.round(whisper.downloadProgress * 100)}%
  </div>
)}
```

- [ ] **Step 2: Run full test suite**

Run: `bunx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/App.tsx
git commit -m "feat(#7): add speech engine toggle — Fast (Google) vs Private (On-device)"
```

---

## Acceptance Criteria

### Part 1 (#10)
- [ ] `formatSessionJSON()` returns valid JSON with all session data (no dataUrl in screenshots)
- [ ] `formatSessionMarkdown()` returns markdown with H1 title, link, and screenshot references
- [ ] OutputView has Text/JSON/Markdown toggle buttons
- [ ] Copy button label changes per format
- [ ] All existing tests still pass

### Part 2 (#12)
- [ ] `npx @pointdev/bridge` starts a WebSocket server on port 3456
- [ ] Extension pushes session data to bridge on capture complete (silent fail if bridge not running)
- [ ] MCP tools return session, voice, annotations, screenshots
- [ ] `get_screenshot` returns base64 image data
- [ ] Bridge server handles multiple sessions (latest wins)

### Part 3 (#7)
- [ ] Speech engine toggle visible in idle state: "Fast (Google)" / "Private (On-device)"
- [ ] Web Speech engine works exactly as before (default)
- [ ] Whisper engine downloads model on first use with progress indicator
- [ ] Whisper engine produces `VoiceSegment[]` with same interface
- [ ] Both engines feed the same `setVoiceSignal` for screenshot intelligence
- [ ] Model cached by browser after first download

---

## Test Plan

```bash
# Run all unit tests
bunx vitest run

# Manual test Part 1: format toggle
# 1. Capture a session with voice + annotations
# 2. On output screen, click JSON — verify valid JSON in output area
# 3. Click Markdown — verify H1 header and screenshot references
# 4. Click Text — verify original format
# 5. Copy each format — paste into editor, verify structure

# Manual test Part 2: bridge server
# 1. In terminal: cd bridge && bun run dev
# 2. In Chrome: capture a session, stop
# 3. In terminal: verify "session_updated" log appears
# 4. Kill bridge, capture again — verify no errors in extension

# Manual test Part 3: speech engine
# 1. Toggle to "Private (On-device)" in idle state
# 2. Start capture — verify model download progress shows
# 3. Speak — verify transcription appears (may be placeholder until WASM compiled)
# 4. Toggle back to "Fast (Google)" — verify Web Speech still works
```
