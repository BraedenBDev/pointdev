# PointDev MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Chrome extension (MV3) proof of concept that captures structured browser context (element selection, voice narration, canvas annotations, cursor tracking) and compiles it into a structured prompt with copy-to-clipboard.

**Architecture:** Chrome MV3 extension with three cooperating contexts — sidepanel (React, voice recording), service worker (state coordination), content script (DOM capture, canvas overlay, cursor tracking). Message passing via `chrome.runtime`. Template formatter compiles `CaptureSession` into plain text.

**Tech Stack:** React 18, TypeScript, Vite + CRXJS, bun, Vitest, Web Speech API, HTML5 Canvas, css-selector-generator

**Spec:** `docs/superpowers/specs/2026-03-15-pointdev-mvp-design.md`

---

## Chunk 1: Project Scaffold & Shared Types

### Task 1: Initialize project and MV3 scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/manifest.json`
- Create: `src/sidepanel/index.html`
- Create: `src/sidepanel/main.tsx`
- Create: `src/sidepanel/App.tsx`
- Create: `src/background/service-worker.ts`
- Create: `src/content/index.ts`
- Create: `public/icons/icon16.png`
- Create: `public/icons/icon48.png`
- Create: `public/icons/icon128.png`

- [ ] **Step 1: Initialize bun project**

```bash
cd /Users/Braeden-ai/Developer/PointDev
bun init
```

- [ ] **Step 2: Install dependencies**

```bash
bun add react react-dom
bun add -D typescript @types/react @types/react-dom @types/chrome vite @vitejs/plugin-react @crxjs/vite-plugin@beta vitest @testing-library/react @testing-library/jest-dom jsdom css-selector-generator eslint prettier
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.json'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
```

- [ ] **Step 5: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "PointDev",
  "version": "0.1.0",
  "description": "Structured browser context capture for AI-assisted development",
  "permissions": ["activeTab", "scripting", "sidePanel", "storage"],
  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "action": {
    "default_title": "Open PointDev",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 6: Create sidepanel entry files**

`src/sidepanel/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PointDev</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

`src/sidepanel/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(<App />)
```

`src/sidepanel/App.tsx`:
```tsx
export function App() {
  return <div>PointDev</div>
}
```

- [ ] **Step 7: Create minimal service worker**

`src/background/service-worker.ts`:
```typescript
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

chrome.runtime.onInstalled.addListener(() => {
  console.log('PointDev installed')
})
```

- [ ] **Step 8: Create minimal content script**

`src/content/index.ts`:
```typescript
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG' })
    return true
  }
})
```

- [ ] **Step 9: Create placeholder icons**

Generate simple 16x16, 48x48, 128x128 PNG icons (solid colored square with "PD" text, or plain colored square). Place in `public/icons/`.

- [ ] **Step 10: Create test setup**

`tests/setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 11: Add package.json scripts**

Add to `package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/ --ext .ts,.tsx"
  }
}
```

- [ ] **Step 12: Create .gitignore**

`.gitignore`:
```
node_modules/
dist/
.env
*.local
```

- [ ] **Step 13: Build and verify**

```bash
bun build
```
Expected: builds to `dist/` without errors.

- [ ] **Step 13: Commit**

```bash
git init
git add -A
git commit -m "feat: initialize MV3 extension scaffold with React sidepanel, Vite + CRXJS build"
```

---

### Task 2: Shared types and message definitions

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/messages.ts`
- Test: `tests/shared/types.test.ts`

- [ ] **Step 1: Write type test**

`tests/shared/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import type { CaptureSession, CircleCoords, ArrowCoords } from '@shared/types'

describe('CaptureSession types', () => {
  it('creates a valid empty session', () => {
    const session: CaptureSession = {
      id: 'test-1',
      tabId: 1,
      startedAt: Date.now(),
      url: 'https://example.com',
      title: 'Test',
      viewport: { width: 1200, height: 800 },
      selectedElement: null,
      voiceRecording: null,
      annotations: [],
      cursorTrace: [],
      screenshot: null,
    }
    expect(session.id).toBe('test-1')
    expect(session.annotations).toHaveLength(0)
  })

  it('creates a session with all layers populated', () => {
    const session: CaptureSession = {
      id: 'test-2',
      tabId: 1,
      startedAt: 1000,
      url: 'https://example.com',
      title: 'Test',
      viewport: { width: 1200, height: 800 },
      selectedElement: {
        selector: 'div.hero > h1',
        computedStyles: { 'font-size': '32px' },
        domSubtree: '<h1>Hello</h1>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
        reactComponent: { name: 'HeroSection', filePath: 'src/Hero.tsx' },
      },
      voiceRecording: {
        transcript: 'the font is too small',
        durationMs: 5000,
        segments: [{ text: 'the font is too small', startMs: 2300, endMs: 4800 }],
      },
      annotations: [
        {
          type: 'circle',
          coordinates: { centerX: 340, centerY: 180, radiusX: 85, radiusY: 85 } as CircleCoords,
          timestampMs: 2300,
          nearestElement: 'div.hero > h1',
        },
      ],
      cursorTrace: [
        { x: 340, y: 180, timestampMs: 2200, nearestElement: 'div.hero > h1', dwellMs: 3100 },
      ],
      screenshot: 'data:image/png;base64,abc',
    }
    expect(session.selectedElement?.reactComponent?.name).toBe('HeroSection')
    expect(session.annotations).toHaveLength(1)
    expect(session.annotations[0].type).toBe('circle')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/shared/types.test.ts
```
Expected: FAIL — module `@shared/types` not found.

- [ ] **Step 3: Create types.ts**

`src/shared/types.ts`:
```typescript
export interface CaptureSession {
  id: string
  tabId: number
  startedAt: number
  url: string
  title: string
  viewport: { width: number; height: number }

  selectedElement: SelectedElementData | null

  voiceRecording: VoiceRecordingData | null

  annotations: AnnotationData[]

  cursorTrace: CursorSampleData[]

  screenshot: string | null
}

export interface SelectedElementData {
  selector: string
  computedStyles: Record<string, string>
  domSubtree: string
  boundingRect: DOMRect
  reactComponent?: {
    name: string
    filePath?: string
  }
}

export interface VoiceRecordingData {
  transcript: string
  durationMs: number
  segments: VoiceSegment[]
}

export interface VoiceSegment {
  text: string
  startMs: number
  endMs: number
}

export interface AnnotationData {
  type: 'circle' | 'arrow'
  coordinates: CircleCoords | ArrowCoords
  timestampMs: number
  nearestElement?: string
}

export interface CircleCoords {
  centerX: number
  centerY: number
  radiusX: number
  radiusY: number
}

export interface ArrowCoords {
  startX: number
  startY: number
  endX: number
  endY: number
}

export interface CursorSampleData {
  x: number
  y: number
  timestampMs: number
  nearestElement?: string
  dwellMs?: number
}

export function createEmptySession(id: string, tabId: number, url: string, title: string, viewport: { width: number; height: number }): CaptureSession {
  return {
    id,
    tabId,
    startedAt: Date.now(),
    url,
    title,
    viewport,
    selectedElement: null,
    voiceRecording: null,
    annotations: [],
    cursorTrace: [],
    screenshot: null,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/shared/types.test.ts
```
Expected: PASS

- [ ] **Step 5: Create messages.ts**

`src/shared/messages.ts`:
```typescript
import type { SelectedElementData, AnnotationData, CursorSampleData, VoiceSegment, CaptureSession } from './types'

export type Message =
  // Sidepanel → Service Worker
  | { type: 'START_CAPTURE' }
  | { type: 'STOP_CAPTURE' }
  | { type: 'SET_MODE'; mode: CaptureMode }
  | { type: 'TRANSCRIPT_UPDATE'; data: { transcript: string; segment: VoiceSegment } }

  // Service Worker → Content Script
  | { type: 'INJECT_CAPTURE'; tabId: number }
  | { type: 'REMOVE_CAPTURE' }
  | { type: 'MODE_CHANGED'; mode: CaptureMode }
  | { type: 'PING' }

  // Content Script → Service Worker
  | { type: 'ELEMENT_SELECTED'; data: SelectedElementData }
  | { type: 'ANNOTATION_ADDED'; data: AnnotationData }
  | { type: 'CURSOR_BATCH'; data: CursorSampleData[] }
  | { type: 'PONG' }

  // Service Worker → Sidepanel
  | { type: 'SESSION_UPDATED'; session: CaptureSession }
  | { type: 'CAPTURE_COMPLETE'; session: CaptureSession }
  | { type: 'CAPTURE_ERROR'; error: string }

export type CaptureMode = 'select' | 'circle' | 'arrow'
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/ tests/shared/
git commit -m "feat: add shared types and message definitions for CaptureSession"
```

---

### Task 3: Web Speech API sidepanel spike

**Files:**
- Create: `src/sidepanel/hooks/useSpeechRecognition.ts`
- Test: `tests/sidepanel/hooks/useSpeechRecognition.test.ts`

This is the highest-risk technical validation. Must confirm Web Speech API works in a Chrome sidepanel context.

- [ ] **Step 1: Write the hook test**

`tests/sidepanel/hooks/useSpeechRecognition.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSpeechRecognition } from '../../../src/sidepanel/hooks/useSpeechRecognition'

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  abort = vi.fn()
}

beforeEach(() => {
  vi.stubGlobal('SpeechRecognition', MockSpeechRecognition)
  vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition)
})

describe('useSpeechRecognition', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isListening).toBe(false)
    expect(result.current.transcript).toBe('')
    expect(result.current.segments).toEqual([])
  })

  it('starts listening', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start(Date.now()) })
    expect(result.current.isListening).toBe(true)
  })

  it('stops listening', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start(Date.now()) })
    act(() => { result.current.stop() })
    expect(result.current.isListening).toBe(false)
  })

  it('reports unavailable when SpeechRecognition is missing', () => {
    vi.stubGlobal('SpeechRecognition', undefined)
    vi.stubGlobal('webkitSpeechRecognition', undefined)
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isAvailable).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/sidepanel/hooks/useSpeechRecognition.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement useSpeechRecognition hook**

`src/sidepanel/hooks/useSpeechRecognition.ts`:
```typescript
import { useState, useRef, useCallback } from 'react'
import type { VoiceSegment } from '@shared/types'

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null

interface UseSpeechRecognitionReturn {
  isAvailable: boolean
  isListening: boolean
  transcript: string
  interimTranscript: string
  segments: VoiceSegment[]
  error: string | null
  start: (captureStartedAt: number) => void
  stop: () => void
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [segments, setSegments] = useState<VoiceSegment[]>([])
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const captureStartRef = useRef<number>(0)

  const isAvailable = SpeechRecognitionAPI != null

  const start = useCallback((captureStartedAt: number) => {
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition is not available in this browser')
      return
    }

    captureStartRef.current = captureStartedAt
    setTranscript('')
    setInterimTranscript('')
    setSegments([])
    setError(null)

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language

    recognition.onresult = (event: any) => {
      let interim = ''
      const newSegments: VoiceSegment[] = []

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          if (text) {
            const now = Date.now()
            newSegments.push({
              text,
              startMs: now - captureStartRef.current - 1000, // approximate
              endMs: now - captureStartRef.current,
            })
          }
        } else {
          interim += result[0].transcript
        }
      }

      if (newSegments.length > 0) {
        setSegments(prev => {
          const updated = [...prev, ...newSegments]
          setTranscript(updated.map(s => s.text).join(' '))
          return updated
        })
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setError('Microphone access is needed for voice capture.')
      } else if (event.error !== 'no-speech') {
        setError(`Speech recognition error: ${event.error}`)
      }
    }

    recognition.onend = () => {
      // Restart if still supposed to be listening (continuous mode can stop unexpectedly)
      if (recognitionRef.current === recognition) {
        try { recognition.start() } catch { setIsListening(false) }
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      const recognition = recognitionRef.current
      recognitionRef.current = null
      recognition.stop()
    }
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  return { isAvailable, isListening, transcript, interimTranscript, segments, error, start, stop }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/sidepanel/hooks/useSpeechRecognition.test.ts
```
Expected: PASS

- [ ] **Step 5: Manual spike test in Chrome sidepanel**

Build, load unpacked in Chrome, open sidepanel. Temporarily add a "Test Mic" button to `App.tsx` that calls `useSpeechRecognition().start()` and displays the transcript. Verify:
1. Microphone permission prompt appears
2. Speech is transcribed to text
3. No errors in the extension console

If this fails, implement Fallback A (offscreen document). Document the result.

- [ ] **Step 6: Remove spike test button, commit**

```bash
git add src/sidepanel/hooks/ tests/sidepanel/
git commit -m "feat: add useSpeechRecognition hook with Web Speech API (sidepanel validated)"
```

---

## Chunk 2: Service Worker & Template Formatter

### Task 4: Service worker state management

**Files:**
- Create: `src/background/session-store.ts`
- Modify: `src/background/service-worker.ts`
- Test: `tests/background/session-store.test.ts`

- [ ] **Step 1: Write session store test**

`tests/background/session-store.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionStore } from '../../src/background/session-store'
import type { SelectedElementData, AnnotationData, CursorSampleData, VoiceSegment } from '@shared/types'

// Mock chrome.storage.session
const mockStorage: Record<string, any> = {}
vi.stubGlobal('chrome', {
  storage: {
    session: {
      set: vi.fn((items: Record<string, any>) => {
        Object.assign(mockStorage, items)
        return Promise.resolve()
      }),
      get: vi.fn((keys: string[]) => {
        const result: Record<string, any> = {}
        for (const key of keys) {
          if (key in mockStorage) result[key] = mockStorage[key]
        }
        return Promise.resolve(result)
      }),
      remove: vi.fn((keys: string[]) => {
        for (const key of keys) delete mockStorage[key]
        return Promise.resolve()
      }),
    },
  },
})

beforeEach(() => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key]
})

describe('SessionStore', () => {
  it('creates a new session', () => {
    const store = new SessionStore()
    const session = store.startSession(1, 'https://example.com', 'Test Page', { width: 1200, height: 800 })
    expect(session.id).toBeTruthy()
    expect(session.url).toBe('https://example.com')
    expect(session.tabId).toBe(1)
    expect(session.selectedElement).toBeNull()
  })

  it('updates selected element', () => {
    const store = new SessionStore()
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const element: SelectedElementData = {
      selector: 'div.hero > h1',
      computedStyles: { 'font-size': '32px' },
      domSubtree: '<h1>Hello</h1>',
      boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
    }
    store.setSelectedElement(element)
    expect(store.getSession()?.selectedElement?.selector).toBe('div.hero > h1')
  })

  it('adds annotations', () => {
    const store = new SessionStore()
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const annotation: AnnotationData = {
      type: 'circle',
      coordinates: { centerX: 100, centerY: 200, radiusX: 50, radiusY: 50 },
      timestampMs: 2300,
      nearestElement: 'div.hero > h1',
    }
    store.addAnnotation(annotation)
    expect(store.getSession()?.annotations).toHaveLength(1)
  })

  it('updates voice transcript', () => {
    const store = new SessionStore()
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const segment: VoiceSegment = { text: 'hello world', startMs: 1000, endMs: 2000 }
    store.updateTranscript('hello world', segment)
    expect(store.getSession()?.voiceRecording?.transcript).toBe('hello world')
    expect(store.getSession()?.voiceRecording?.segments).toHaveLength(1)
  })

  it('adds cursor batch', () => {
    const store = new SessionStore()
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const batch: CursorSampleData[] = [
      { x: 100, y: 200, timestampMs: 500 },
      { x: 105, y: 202, timestampMs: 600 },
    ]
    store.addCursorBatch(batch)
    expect(store.getSession()?.cursorTrace).toHaveLength(2)
  })

  it('returns null when no active session', () => {
    const store = new SessionStore()
    expect(store.getSession()).toBeNull()
  })

  it('ends session and returns it', () => {
    const store = new SessionStore()
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const session = store.endSession()
    expect(session).toBeTruthy()
    expect(store.getSession()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/background/session-store.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement SessionStore**

`src/background/session-store.ts`:
```typescript
import type { CaptureSession, SelectedElementData, AnnotationData, CursorSampleData, VoiceSegment } from '@shared/types'
import { createEmptySession } from '@shared/types'

export class SessionStore {
  private session: CaptureSession | null = null

  startSession(tabId: number, url: string, title: string, viewport: { width: number; height: number }): CaptureSession {
    const id = `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.session = createEmptySession(id, tabId, url, title, viewport)
    this.persist()
    return { ...this.session }
  }

  getSession(): CaptureSession | null {
    return this.session ? { ...this.session } : null
  }

  setSelectedElement(element: SelectedElementData): void {
    if (!this.session) return
    this.session.selectedElement = element
    this.persist()
  }

  addAnnotation(annotation: AnnotationData): void {
    if (!this.session) return
    this.session.annotations.push(annotation)
    this.persist()
  }

  updateTranscript(transcript: string, segment: VoiceSegment): void {
    if (!this.session) return
    if (!this.session.voiceRecording) {
      this.session.voiceRecording = { transcript: '', durationMs: 0, segments: [] }
    }
    this.session.voiceRecording.transcript = transcript
    this.session.voiceRecording.segments.push(segment)
    this.session.voiceRecording.durationMs = segment.endMs
    this.persist()
  }

  addCursorBatch(samples: CursorSampleData[]): void {
    if (!this.session) return
    this.session.cursorTrace.push(...samples)
    this.persist()
  }

  setScreenshot(dataUrl: string): void {
    if (!this.session) return
    this.session.screenshot = dataUrl
    this.persist()
  }

  endSession(): CaptureSession | null {
    const session = this.session
    this.session = null
    this.clearPersistedSession()
    return session
  }

  async restore(): Promise<CaptureSession | null> {
    try {
      const result = await chrome.storage.session.get(['activeSession'])
      if (result.activeSession) {
        this.session = result.activeSession
        return { ...this.session! }
      }
    } catch {
      // storage.session not available (e.g., in tests without full chrome mock)
    }
    return null
  }

  private persist(): void {
    try {
      chrome.storage.session.set({ activeSession: this.session })
    } catch {
      // Silently fail in environments without chrome.storage
    }
  }

  private clearPersistedSession(): void {
    try {
      chrome.storage.session.remove(['activeSession'])
    } catch {
      // Silently fail
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/background/session-store.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/session-store.ts tests/background/
git commit -m "feat: add SessionStore for capture state management with chrome.storage.session backup"
```

---

### Task 5: Template formatter

**Files:**
- Create: `src/shared/formatter.ts`
- Test: `tests/shared/formatter.test.ts`

- [ ] **Step 1: Write formatter tests**

`tests/shared/formatter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { formatSession } from '../../src/shared/formatter'
import type { CaptureSession } from '@shared/types'

function makeSession(overrides: Partial<CaptureSession> = {}): CaptureSession {
  return {
    id: 'test-1',
    tabId: 1,
    startedAt: 1000,
    url: 'https://example.com/page',
    title: 'Example Page',
    viewport: { width: 1200, height: 800 },
    selectedElement: null,
    voiceRecording: null,
    annotations: [],
    cursorTrace: [],
    screenshot: null,
    ...overrides,
  }
}

describe('formatSession', () => {
  it('formats context section for minimal session', () => {
    const output = formatSession(makeSession())
    expect(output).toContain('## Context')
    expect(output).toContain('URL: https://example.com/page')
    expect(output).toContain('Page title: Example Page')
    expect(output).toContain('Viewport: 1200 x 800px')
  })

  it('omits Target Element section when no element selected', () => {
    const output = formatSession(makeSession())
    expect(output).not.toContain('## Target Element')
  })

  it('includes Target Element when element is selected', () => {
    const output = formatSession(makeSession({
      selectedElement: {
        selector: 'div.hero > h1',
        computedStyles: { 'font-size': '32px', 'color': 'rgb(0, 0, 0)' },
        domSubtree: '<h1 class="title">Hello World</h1>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
      },
    }))
    expect(output).toContain('## Target Element')
    expect(output).toContain('Selector: div.hero > h1')
    expect(output).toContain('font-size: 32px')
  })

  it('includes React component name when detected', () => {
    const output = formatSession(makeSession({
      selectedElement: {
        selector: 'div.hero > h1',
        computedStyles: {},
        domSubtree: '<h1>Hello</h1>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
        reactComponent: { name: 'HeroSection', filePath: 'src/Hero.tsx' },
      },
    }))
    expect(output).toContain('React Component: <HeroSection> (src/Hero.tsx)')
  })

  it('omits React Component line when not detected', () => {
    const output = formatSession(makeSession({
      selectedElement: {
        selector: 'div > h1',
        computedStyles: {},
        domSubtree: '<h1>Hello</h1>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
      },
    }))
    expect(output).not.toContain('React Component')
  })

  it('formats voice transcript with timestamps', () => {
    const output = formatSession(makeSession({
      voiceRecording: {
        transcript: 'the font is too small',
        durationMs: 5000,
        segments: [
          { text: 'the font is too small', startMs: 23000, endMs: 25000 },
        ],
      },
    }))
    expect(output).toContain('## User Intent (voice transcript)')
    expect(output).toContain('[00:23]')
    expect(output).toContain('"the font is too small"')
  })

  it('omits voice section when no recording', () => {
    const output = formatSession(makeSession())
    expect(output).not.toContain('## User Intent')
  })

  it('formats circle annotations', () => {
    const output = formatSession(makeSession({
      annotations: [{
        type: 'circle',
        coordinates: { centerX: 340, centerY: 180, radiusX: 85, radiusY: 85 },
        timestampMs: 2300,
        nearestElement: 'div.hero > h1',
      }],
    }))
    expect(output).toContain('## Annotations')
    expect(output).toContain('Circle around div.hero > h1')
  })

  it('formats arrow annotations', () => {
    const output = formatSession(makeSession({
      annotations: [{
        type: 'arrow',
        coordinates: { startX: 100, startY: 200, endX: 300, endY: 400 },
        timestampMs: 3000,
        nearestElement: 'nav > a',
      }],
    }))
    expect(output).toContain('Arrow')
    expect(output).toContain('nav > a')
  })

  it('omits Annotations section when no annotations', () => {
    const output = formatSession(makeSession())
    expect(output).not.toContain('## Annotations')
  })

  it('formats cursor dwells', () => {
    const output = formatSession(makeSession({
      cursorTrace: [
        { x: 340, y: 180, timestampMs: 2200, nearestElement: 'div.hero > h1', dwellMs: 3100 },
      ],
    }))
    expect(output).toContain('## Cursor Behavior')
    expect(output).toContain('div.hero > h1')
    expect(output).toContain('3.1s')
  })

  it('omits cursor section when no dwells', () => {
    const output = formatSession(makeSession({
      cursorTrace: [
        { x: 100, y: 200, timestampMs: 500 }, // no dwellMs = not a dwell
      ],
    }))
    expect(output).not.toContain('## Cursor Behavior')
  })

  it('suppresses cursor dwells that overlap with annotations', () => {
    const output = formatSession(makeSession({
      annotations: [{
        type: 'circle',
        coordinates: { centerX: 340, centerY: 180, radiusX: 85, radiusY: 85 },
        timestampMs: 2300,
        nearestElement: 'div.hero > h1',
      }],
      cursorTrace: [
        { x: 340, y: 180, timestampMs: 2200, nearestElement: 'div.hero > h1', dwellMs: 3100 },
      ],
    }))
    // Dwell on same element as annotation should be suppressed
    expect(output).not.toContain('## Cursor Behavior')
  })

  it('reconstructs shorthand padding when all sides equal', () => {
    const output = formatSession(makeSession({
      selectedElement: {
        selector: 'div',
        computedStyles: {
          'padding-top': '8px',
          'padding-right': '8px',
          'padding-bottom': '8px',
          'padding-left': '8px',
        },
        domSubtree: '<div></div>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
      },
    }))
    expect(output).toContain('padding: 8px')
    expect(output).not.toContain('padding-top')
  })

  it('truncates long DOM subtrees', () => {
    const longHtml = '<div class="wrapper">' + '<span>x</span>'.repeat(100) + '</div>'
    const output = formatSession(makeSession({
      selectedElement: {
        selector: 'div',
        computedStyles: {},
        domSubtree: longHtml,
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
      },
    }))
    expect(output).toContain('<!-- truncated -->')
    // Should not exceed ~550 chars for the DOM line
    const domLine = output.split('\n').find(l => l.startsWith('- DOM:'))
    expect(domLine!.length).toBeLessThan(600)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/shared/formatter.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement formatter**

`src/shared/formatter.ts`:
```typescript
import type { CaptureSession, CircleCoords, ArrowCoords } from './types'

export function formatSession(session: CaptureSession): string {
  const sections: string[] = []

  sections.push(formatContext(session))

  if (session.selectedElement) {
    sections.push(formatTargetElement(session))
  }

  if (session.voiceRecording && session.voiceRecording.segments.length > 0) {
    sections.push(formatVoiceTranscript(session))
  }

  if (session.annotations.length > 0) {
    sections.push(formatAnnotations(session))
  }

  const dwells = getUnsuppressedDwells(session)
  if (dwells.length > 0) {
    sections.push(formatCursorBehavior(dwells, session))
  }

  if (session.screenshot) {
    sections.push(`## Screenshot\n${session.screenshot}`)
  }

  return sections.join('\n\n')
}

function formatContext(session: CaptureSession): string {
  const lines = [
    '## Context',
    `- URL: ${session.url}`,
    `- Page title: ${session.title}`,
    `- Viewport: ${session.viewport.width} x ${session.viewport.height}px`,
    `- Captured at: ${new Date(session.startedAt).toISOString().replace('T', ' ').slice(0, 19)}`,
  ]
  return lines.join('\n')
}

function formatTargetElement(session: CaptureSession): string {
  const el = session.selectedElement!
  const lines = ['## Target Element', `- Selector: ${el.selector}`]

  if (el.reactComponent) {
    const filePart = el.reactComponent.filePath ? ` (${el.reactComponent.filePath})` : ''
    lines.push(`- React Component: <${el.reactComponent.name}>${filePart}`)
  }

  const computedStr = formatComputedStyles(el.computedStyles)
  if (computedStr) {
    lines.push(`- Computed: ${computedStr}`)
  }

  lines.push(`- DOM: ${truncateDom(el.domSubtree)}`)

  return lines.join('\n')
}

function formatComputedStyles(styles: Record<string, string>): string {
  const result: string[] = []

  // Reconstruct shorthand padding
  const pt = styles['padding-top'], pr = styles['padding-right'],
        pb = styles['padding-bottom'], pl = styles['padding-left']
  if (pt && pr && pb && pl) {
    if (pt === pr && pr === pb && pb === pl) {
      result.push(`padding: ${pt}`)
    } else {
      result.push(`padding: ${pt} ${pr} ${pb} ${pl}`)
    }
  }

  // Reconstruct shorthand margin
  const mt = styles['margin-top'], mr = styles['margin-right'],
        mb = styles['margin-bottom'], ml = styles['margin-left']
  if (mt && mr && mb && ml) {
    if (mt === mr && mr === mb && mb === ml) {
      result.push(`margin: ${mt}`)
    } else {
      result.push(`margin: ${mt} ${mr} ${mb} ${ml}`)
    }
  }

  // Direct properties
  const directProps = ['font-size', 'font-weight', 'font-family', 'color', 'background-color',
                       'width', 'height', 'display', 'position']
  for (const prop of directProps) {
    if (styles[prop]) {
      result.push(`${prop}: ${styles[prop]}`)
    }
  }

  return result.join(', ')
}

function truncateDom(html: string): string {
  if (html.length <= 500) return html
  return html.slice(0, 500) + '<!-- truncated -->'
}

function formatVoiceTranscript(session: CaptureSession): string {
  const lines = ['## User Intent (voice transcript)']
  for (const seg of session.voiceRecording!.segments) {
    lines.push(`[${formatTimestamp(seg.startMs)}] "${seg.text}"`)
  }
  return lines.join('\n')
}

function formatAnnotations(session: CaptureSession): string {
  const lines = ['## Annotations']
  session.annotations.forEach((ann, i) => {
    const ts = formatTimestamp(ann.timestampMs)
    if (ann.type === 'circle') {
      const c = ann.coordinates as CircleCoords
      const target = ann.nearestElement || 'unknown element'
      lines.push(`${i + 1}. [${ts}] Circle around ${target} at (${c.centerX}, ${c.centerY}), radius ${c.radiusX}px`)
    } else {
      const a = ann.coordinates as ArrowCoords
      const target = ann.nearestElement || 'unknown element'
      lines.push(`${i + 1}. [${ts}] Arrow from (${a.startX}, ${a.startY}) to (${a.endX}, ${a.endY}), pointing at ${target}`)
    }
  })
  return lines.join('\n')
}

interface DwellEntry {
  x: number
  y: number
  timestampMs: number
  nearestElement?: string
  dwellMs: number
}

function getUnsuppressedDwells(session: CaptureSession): DwellEntry[] {
  const annotatedElements = new Set(session.annotations.map(a => a.nearestElement).filter(Boolean))
  return session.cursorTrace
    .filter((s): s is DwellEntry => s.dwellMs != null && s.dwellMs > 0)
    .filter(s => !s.nearestElement || !annotatedElements.has(s.nearestElement))
}

function formatCursorBehavior(dwells: DwellEntry[], session: CaptureSession): string {
  const lines = ['## Cursor Behavior']
  for (const dwell of dwells) {
    const startTs = formatTimestamp(dwell.timestampMs)
    const endTs = formatTimestamp(dwell.timestampMs + dwell.dwellMs)
    const target = dwell.nearestElement || 'unknown element'
    const seconds = (dwell.dwellMs / 1000).toFixed(1)

    // Correlate with voice segments
    let correlation = ''
    if (session.voiceRecording) {
      const overlapping = session.voiceRecording.segments.find(seg =>
        seg.startMs <= dwell.timestampMs + dwell.dwellMs && seg.endMs >= dwell.timestampMs
      )
      if (overlapping) {
        correlation = ` (during: "${overlapping.text}")`
      }
    }

    lines.push(`- [${startTs}\u2013${endTs}] Dwelled ${seconds}s over ${target}${correlation}`)
  }
  return lines.join('\n')
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/shared/formatter.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/formatter.ts tests/shared/formatter.test.ts
git commit -m "feat: add template formatter that compiles CaptureSession into structured plain text"
```

---

### Task 6: Service worker message routing

**Files:**
- Modify: `src/background/service-worker.ts`
- Test: `tests/background/service-worker.test.ts`

- [ ] **Step 1: Write service worker message handler tests**

`tests/background/service-worker.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleMessage } from '../../src/background/message-handler'
import { SessionStore } from '../../src/background/session-store'

// Mock chrome APIs
vi.stubGlobal('chrome', {
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com', title: 'Test' }]),
    captureVisibleTab: vi.fn().mockResolvedValue('data:image/png;base64,abc'),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
  scripting: {
    executeScript: vi.fn().mockResolvedValue(undefined),
  },
  storage: {
    session: {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  },
})

describe('handleMessage', () => {
  let store: SessionStore

  beforeEach(() => {
    store = new SessionStore()
    vi.clearAllMocks()
  })

  it('handles START_CAPTURE', async () => {
    const result = await handleMessage({ type: 'START_CAPTURE' }, store)
    expect(result.type).toBe('SESSION_UPDATED')
    expect(store.getSession()).toBeTruthy()
  })

  it('handles ELEMENT_SELECTED', async () => {
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    await handleMessage({
      type: 'ELEMENT_SELECTED',
      data: {
        selector: 'h1',
        computedStyles: {},
        domSubtree: '<h1>Hi</h1>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
      },
    }, store)
    expect(store.getSession()?.selectedElement?.selector).toBe('h1')
  })

  it('handles STOP_CAPTURE', async () => {
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const result = await handleMessage({ type: 'STOP_CAPTURE' }, store)
    expect(result.type).toBe('CAPTURE_COMPLETE')
    expect(store.getSession()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/background/service-worker.test.ts
```

- [ ] **Step 3: Implement message handler**

`src/background/message-handler.ts`:
```typescript
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
            files: ['src/content/index.ts'],
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

      // Take screenshot before removing overlay
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (activeTab?.id === session.tabId) {
          await chrome.tabs.sendMessage(session.tabId, { type: 'REMOVE_CAPTURE' })
          // Brief delay for overlay removal
          await new Promise(r => setTimeout(r, 50))
          const screenshot = await chrome.tabs.captureVisibleTab()
          store.setScreenshot(screenshot)
        } else {
          await chrome.tabs.sendMessage(session.tabId, { type: 'REMOVE_CAPTURE' }).catch(() => {})
        }
      } catch {
        // Screenshot failed, proceed without it
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

    default:
      return undefined
  }
}
```

- [ ] **Step 4: Update service-worker.ts to wire up message handler**

`src/background/service-worker.ts`:
```typescript
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
```

- [ ] **Step 5: Run tests**

```bash
bun test tests/background/
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/background/ tests/background/
git commit -m "feat: add service worker message routing with session lifecycle management"
```

---

## Chunk 3: Content Script — Element Selector & Canvas Overlay

### Task 7: Element selector

**Files:**
- Create: `src/content/element-selector.ts`
- Test: `tests/content/element-selector.test.ts`

- [ ] **Step 1: Write element selector test**

`tests/content/element-selector.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { extractElementData, COMPUTED_STYLE_PROPS } from '../../src/content/element-selector'

// Mock document and window
const mockElement = {
  tagName: 'H1',
  className: 'hero-title',
  id: '',
  outerHTML: '<h1 class="hero-title">Hello World</h1>',
  getBoundingClientRect: () => ({ x: 10, y: 20, width: 200, height: 40, top: 20, right: 210, bottom: 60, left: 10, toJSON: () => ({}) }),
  getAttribute: vi.fn(() => null),
  closest: vi.fn(() => null),
}

describe('extractElementData', () => {
  it('extracts selector, styles, and DOM subtree', () => {
    const mockGetComputedStyle = vi.fn(() => {
      const styles: Record<string, string> = { 'font-size': '32px', 'color': 'rgb(0,0,0)' }
      return { getPropertyValue: (prop: string) => styles[prop] || '' }
    })

    const data = extractElementData(
      mockElement as any,
      'h1.hero-title',
      mockGetComputedStyle as any,
      { scrollX: 0, scrollY: 100 }
    )

    expect(data.selector).toBe('h1.hero-title')
    expect(data.domSubtree).toContain('hero-title')
    expect(data.boundingRect).toBeTruthy()
  })

  it('defines the correct computed style properties list', () => {
    expect(COMPUTED_STYLE_PROPS).toContain('font-size')
    expect(COMPUTED_STYLE_PROPS).toContain('padding-top')
    expect(COMPUTED_STYLE_PROPS).toContain('margin-left')
    expect(COMPUTED_STYLE_PROPS).not.toContain('padding') // shorthand
    expect(COMPUTED_STYLE_PROPS).not.toContain('margin')   // shorthand
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/content/element-selector.test.ts
```

- [ ] **Step 3: Implement element selector**

`src/content/element-selector.ts`:
```typescript
import type { SelectedElementData } from '@shared/types'

export const COMPUTED_STYLE_PROPS = [
  'font-size', 'font-weight', 'font-family',
  'color', 'background-color',
  'width', 'height',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'display', 'position',
]

export function extractElementData(
  element: Element,
  selector: string,
  getComputedStyle: (el: Element) => CSSStyleDeclaration,
  scroll: { scrollX: number; scrollY: number }
): SelectedElementData {
  const computed = getComputedStyle(element)
  const styles: Record<string, string> = {}
  for (const prop of COMPUTED_STYLE_PROPS) {
    const value = computed.getPropertyValue(prop)
    if (value && value !== '' && value !== 'normal' && value !== 'none' && value !== 'auto') {
      styles[prop] = value
    }
  }

  const rect = element.getBoundingClientRect()
  const boundingRect = {
    x: rect.x + scroll.scrollX,
    y: rect.y + scroll.scrollY,
    width: rect.width,
    height: rect.height,
    top: rect.top + scroll.scrollY,
    right: rect.right + scroll.scrollX,
    bottom: rect.bottom + scroll.scrollY,
    left: rect.left + scroll.scrollX,
    toJSON: () => ({}),
  }

  let domSubtree = element.outerHTML
  if (domSubtree.length > 500) {
    domSubtree = domSubtree.slice(0, 500) + '<!-- truncated -->'
  }

  return {
    selector,
    computedStyles: styles,
    domSubtree,
    boundingRect: boundingRect as DOMRect,
  }
}

export function findNearestElement(
  viewportX: number,
  viewportY: number,
  doc: Document
): Element | null {
  const elements = doc.elementsFromPoint(viewportX, viewportY)
  for (const el of elements) {
    if (el.hasAttribute('data-pointdev')) continue
    if (el.tagName === 'HTML' || el.tagName === 'BODY') continue
    return el
  }
  return null
}
```

- [ ] **Step 4: Run test**

```bash
bun test tests/content/element-selector.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/content/element-selector.ts tests/content/
git commit -m "feat: add element selector with computed styles extraction and DOM truncation"
```

---

### Task 8: Canvas annotation overlay

**Files:**
- Create: `src/content/canvas-overlay.ts`
- Test: `tests/content/canvas-overlay.test.ts`

- [ ] **Step 1: Write canvas overlay test**

`tests/content/canvas-overlay.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { CanvasOverlay } from '../../src/content/canvas-overlay'

// Minimal canvas mock
function createMockCanvas() {
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    set strokeStyle(v: string) {},
    set fillStyle(v: string) {},
    set lineWidth(v: number) {},
  }
  return {
    getContext: vi.fn(() => ctx),
    setAttribute: vi.fn(),
    style: {} as any,
    width: 1200,
    height: 800,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
    ctx,
  }
}

describe('CanvasOverlay', () => {
  it('creates canvas with correct attributes', () => {
    const mockDoc = {
      createElement: vi.fn(() => createMockCanvas()),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, { innerWidth: 1200, innerHeight: 800, scrollX: 0, scrollY: 0 } as any)
    expect(mockDoc.createElement).toHaveBeenCalledWith('canvas')
  })

  it('records circle annotation on draw complete', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
      elementsFromPoint: vi.fn(() => []),
    }
    const overlay = new CanvasOverlay(mockDoc as any, { innerWidth: 1200, innerHeight: 800, scrollX: 0, scrollY: 0 } as any)
    overlay.setMode('circle')

    const annotation = overlay.completeAnnotation(
      { clientX: 100, clientY: 200 }, // start
      { clientX: 150, clientY: 250 }, // end
      1000, // captureStartedAt
      2300  // now
    )

    expect(annotation).toBeTruthy()
    expect(annotation!.type).toBe('circle')
  })

  it('records arrow annotation on draw complete', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
      elementsFromPoint: vi.fn(() => []),
    }
    const overlay = new CanvasOverlay(mockDoc as any, { innerWidth: 1200, innerHeight: 800, scrollX: 0, scrollY: 0 } as any)
    overlay.setMode('arrow')

    const annotation = overlay.completeAnnotation(
      { clientX: 100, clientY: 200 },
      { clientX: 300, clientY: 400 },
      1000,
      3000
    )

    expect(annotation).toBeTruthy()
    expect(annotation!.type).toBe('arrow')
  })

  it('returns null for select mode', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, { innerWidth: 1200, innerHeight: 800, scrollX: 0, scrollY: 0 } as any)
    overlay.setMode('select')

    const annotation = overlay.completeAnnotation(
      { clientX: 100, clientY: 200 },
      { clientX: 150, clientY: 250 },
      1000, 2300
    )
    expect(annotation).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/content/canvas-overlay.test.ts
```

- [ ] **Step 3: Implement CanvasOverlay**

`src/content/canvas-overlay.ts`:
```typescript
import type { AnnotationData, CircleCoords, ArrowCoords } from '@shared/types'
import type { CaptureMode } from '@shared/messages'
import { findNearestElement } from './element-selector'

const STROKE_COLOR = '#FF3333'
const STROKE_WIDTH = 2
const ARROW_HEAD_SIZE = 12

interface Point { clientX: number; clientY: number }

export class CanvasOverlay {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private mode: CaptureMode = 'select'
  private doc: Document
  private win: Window
  private drawnAnnotations: Array<{ type: 'circle' | 'arrow'; data: any }> = []

  constructor(doc: Document, win: Window) {
    this.doc = doc
    this.win = win

    this.canvas = doc.createElement('canvas')
    this.canvas.setAttribute('data-pointdev', 'overlay')
    this.canvas.width = win.innerWidth
    this.canvas.height = win.innerHeight

    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483647',
      pointerEvents: 'none',
      cursor: 'crosshair',
    })

    this.ctx = this.canvas.getContext('2d')!
    doc.body.appendChild(this.canvas)
  }

  setMode(mode: CaptureMode): void {
    this.mode = mode
    this.canvas.style.pointerEvents = mode === 'select' ? 'none' : 'all'
  }

  getMode(): CaptureMode {
    return this.mode
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  drawCirclePreview(start: Point, current: Point): void {
    this.redraw()
    const cx = start.clientX
    const cy = start.clientY
    const rx = Math.abs(current.clientX - start.clientX)
    const ry = Math.abs(current.clientY - start.clientY)
    this.drawEllipse(cx, cy, rx, ry)
  }

  drawArrowPreview(start: Point, current: Point): void {
    this.redraw()
    this.drawArrow(start.clientX, start.clientY, current.clientX, current.clientY)
  }

  completeAnnotation(
    start: Point,
    end: Point,
    captureStartedAt: number,
    now: number
  ): AnnotationData | null {
    if (this.mode === 'select') return null

    const scrollX = this.win.scrollX
    const scrollY = this.win.scrollY
    const timestampMs = now - captureStartedAt

    if (this.mode === 'circle') {
      const cx = start.clientX
      const cy = start.clientY
      const rx = Math.abs(end.clientX - start.clientX)
      const ry = Math.abs(end.clientY - start.clientY)

      if (rx < 5 && ry < 5) return null // too small

      this.drawnAnnotations.push({ type: 'circle', data: { cx, cy, rx, ry } })
      this.redraw()

      const coordinates: CircleCoords = {
        centerX: cx + scrollX,
        centerY: cy + scrollY,
        radiusX: rx,
        radiusY: ry,
      }

      return {
        type: 'circle',
        coordinates,
        timestampMs,
        // nearestElement resolved by caller (content script coordinator) using css-selector-generator
      }
    }

    if (this.mode === 'arrow') {
      const sx = start.clientX, sy = start.clientY
      const ex = end.clientX, ey = end.clientY

      const dist = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)
      if (dist < 10) return null // too small

      this.drawnAnnotations.push({ type: 'arrow', data: { sx, sy, ex, ey } })
      this.redraw()

      const coordinates: ArrowCoords = {
        startX: sx + scrollX,
        startY: sy + scrollY,
        endX: ex + scrollX,
        endY: ey + scrollY,
      }

      return {
        type: 'arrow',
        coordinates,
        timestampMs,
        // nearestElement resolved by caller (content script coordinator) using css-selector-generator
      }
    }

    return null
  }

  private redraw(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    for (const ann of this.drawnAnnotations) {
      if (ann.type === 'circle') {
        this.drawEllipse(ann.data.cx, ann.data.cy, ann.data.rx, ann.data.ry)
      } else {
        this.drawArrow(ann.data.sx, ann.data.sy, ann.data.ex, ann.data.ey)
      }
    }
  }

  private drawEllipse(cx: number, cy: number, rx: number, ry: number): void {
    this.ctx.strokeStyle = STROKE_COLOR
    this.ctx.lineWidth = STROKE_WIDTH
    this.ctx.beginPath()
    this.ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2)
    this.ctx.stroke()
  }

  private drawArrow(sx: number, sy: number, ex: number, ey: number): void {
    this.ctx.strokeStyle = STROKE_COLOR
    this.ctx.fillStyle = STROKE_COLOR
    this.ctx.lineWidth = STROKE_WIDTH

    // Line
    this.ctx.beginPath()
    this.ctx.moveTo(sx, sy)
    this.ctx.lineTo(ex, ey)
    this.ctx.stroke()

    // Arrowhead
    const angle = Math.atan2(ey - sy, ex - sx)
    this.ctx.save()
    this.ctx.translate(ex, ey)
    this.ctx.rotate(angle)
    this.ctx.beginPath()
    this.ctx.moveTo(0, 0)
    this.ctx.lineTo(-ARROW_HEAD_SIZE, -ARROW_HEAD_SIZE / 2)
    this.ctx.lineTo(-ARROW_HEAD_SIZE, ARROW_HEAD_SIZE / 2)
    this.ctx.fill()
    this.ctx.restore()
  }

  destroy(): void {
    this.canvas.remove()
  }
}
```

- [ ] **Step 4: Run test**

```bash
bun test tests/content/canvas-overlay.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/content/canvas-overlay.ts tests/content/canvas-overlay.test.ts
git commit -m "feat: add canvas annotation overlay with circle and arrow drawing"
```

---

### Task 9: Cursor tracker

**Files:**
- Create: `src/content/cursor-tracker.ts`
- Create: `src/shared/dwell.ts` (pure function, no DOM dependencies — shared between content and sidepanel)
- Test: `tests/content/cursor-tracker.test.ts`

- [ ] **Step 1: Write cursor tracker test**

`tests/content/cursor-tracker.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CursorTracker } from '../../src/content/cursor-tracker'
import { computeDwells } from '../../src/shared/dwell'
import type { CursorSampleData } from '@shared/types'

describe('computeDwells', () => {
  it('detects dwell when cursor stays in 30px radius for >500ms', () => {
    const samples: CursorSampleData[] = [
      { x: 100, y: 200, timestampMs: 0, nearestElement: 'h1' },
      { x: 105, y: 202, timestampMs: 100, nearestElement: 'h1' },
      { x: 102, y: 198, timestampMs: 200, nearestElement: 'h1' },
      { x: 103, y: 201, timestampMs: 300, nearestElement: 'h1' },
      { x: 104, y: 199, timestampMs: 400, nearestElement: 'h1' },
      { x: 101, y: 200, timestampMs: 500, nearestElement: 'h1' },
      { x: 103, y: 201, timestampMs: 600, nearestElement: 'h1' },
    ]
    const dwells = computeDwells(samples)
    expect(dwells.length).toBeGreaterThan(0)
    expect(dwells[0].dwellMs).toBeGreaterThanOrEqual(500)
  })

  it('does not detect dwell for fast-moving cursor', () => {
    const samples: CursorSampleData[] = [
      { x: 100, y: 200, timestampMs: 0 },
      { x: 200, y: 300, timestampMs: 100 },
      { x: 400, y: 100, timestampMs: 200 },
      { x: 50, y: 500, timestampMs: 300 },
    ]
    const dwells = computeDwells(samples)
    expect(dwells).toHaveLength(0)
  })

  it('returns empty for empty input', () => {
    expect(computeDwells([])).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/content/cursor-tracker.test.ts
```

- [ ] **Step 3: Implement cursor tracker**

`src/content/cursor-tracker.ts`:
```typescript
import type { CursorSampleData } from '@shared/types'

const SAMPLE_INTERVAL_MS = 100
const BATCH_INTERVAL_MS = 500
const DWELL_RADIUS_PX = 30
const DWELL_MIN_MS = 500

export class CursorTracker {
  private buffer: CursorSampleData[] = []
  private intervalId: number | null = null
  private lastSampleTime = 0
  private captureStartedAt = 0
  private currentPosition = { x: 0, y: 0 }
  private onBatch: (samples: CursorSampleData[]) => void

  constructor(onBatch: (samples: CursorSampleData[]) => void) {
    this.onBatch = onBatch
  }

  start(captureStartedAt: number, doc: Document, win: Window): void {
    this.captureStartedAt = captureStartedAt
    this.buffer = []

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - this.lastSampleTime < SAMPLE_INTERVAL_MS) return
      this.lastSampleTime = now

      const pageX = e.clientX + win.scrollX
      const pageY = e.clientY + win.scrollY
      this.currentPosition = { x: pageX, y: pageY }

      // Resolve nearest element and generate selector inline
      let nearestSelector: string | undefined
      const element = doc.elementFromPoint(e.clientX, e.clientY)
      if (element && !element.hasAttribute('data-pointdev') && element.tagName !== 'HTML' && element.tagName !== 'BODY') {
        if (element.id) {
          nearestSelector = `#${element.id}`
        } else {
          let tag = element.tagName.toLowerCase()
          if (element.className && typeof element.className === 'string') {
            tag += '.' + element.className.trim().split(/\s+/).slice(0, 2).join('.')
          }
          nearestSelector = tag
        }
      }

      this.buffer.push({
        x: pageX,
        y: pageY,
        timestampMs: now - captureStartedAt,
        nearestElement: nearestSelector,
      })
    }

    doc.addEventListener('mousemove', handleMouseMove)

    this.intervalId = win.setInterval(() => {
      if (this.buffer.length > 0) {
        this.onBatch([...this.buffer])
        this.buffer = []
      }
    }, BATCH_INTERVAL_MS) as unknown as number

    // Store for cleanup
    ;(this as any)._handleMouseMove = handleMouseMove
    ;(this as any)._doc = doc
  }

  stop(): CursorSampleData[] {
    const doc = (this as any)._doc as Document | undefined
    if (doc && (this as any)._handleMouseMove) {
      doc.removeEventListener('mousemove', (this as any)._handleMouseMove)
    }
    if (this.intervalId != null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    // Flush remaining
    const remaining = [...this.buffer]
    this.buffer = []
    return remaining
  }
}

export function computeDwells(samples: CursorSampleData[]): CursorSampleData[] {
  if (samples.length === 0) return []

  const dwells: CursorSampleData[] = []
  let groupStart = 0

  for (let i = 1; i <= samples.length; i++) {
    const outOfRadius = i === samples.length || distance(samples[groupStart], samples[i]) > DWELL_RADIUS_PX
    if (outOfRadius) {
      const duration = samples[i - 1].timestampMs - samples[groupStart].timestampMs
      if (duration >= DWELL_MIN_MS) {
        // Use the first sample's position as the dwell position
        dwells.push({
          ...samples[groupStart],
          dwellMs: duration,
        })
      }
      groupStart = i
    }
  }

  return dwells
}

function distance(a: CursorSampleData, b: CursorSampleData): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}
```

- [ ] **Step 4: Run test**

```bash
bun test tests/content/cursor-tracker.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/content/cursor-tracker.ts tests/content/cursor-tracker.test.ts
git commit -m "feat: add cursor tracker with dwell detection algorithm"
```

---

### Task 10: React fiber inspector

**Files:**
- Create: `src/content/react-inspector.ts`
- Test: `tests/content/react-inspector.test.ts`

- [ ] **Step 1: Write React inspector test**

`tests/content/react-inspector.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { inspectReactComponent } from '../../src/content/react-inspector'

describe('inspectReactComponent', () => {
  it('returns null for elements without React fiber', () => {
    const el = document.createElement('div')
    expect(inspectReactComponent(el)).toBeNull()
  })

  it('detects React component name from fiber', () => {
    const el = document.createElement('div')
    const fiber = {
      type: { name: 'HeroSection', displayName: undefined },
      _debugSource: { fileName: 'src/Hero.tsx', lineNumber: 12 },
      return: null,
    }
    // Simulate React attaching fiber with random suffix
    ;(el as any).__reactFiber$abc123 = fiber

    const result = inspectReactComponent(el)
    expect(result).toBeTruthy()
    expect(result!.name).toBe('HeroSection')
    expect(result!.filePath).toBe('src/Hero.tsx')
  })

  it('prefers displayName over name', () => {
    const el = document.createElement('div')
    const fiber = {
      type: { name: 'X', displayName: 'MyDisplayName' },
      return: null,
    }
    ;(el as any).__reactFiber$xyz = fiber
    const result = inspectReactComponent(el)
    expect(result!.name).toBe('MyDisplayName')
  })

  it('walks up to find nearest user component', () => {
    const el = document.createElement('div')
    const parentFiber = {
      type: { name: 'AppLayout' },
      return: null,
    }
    const childFiber = {
      type: 'div', // built-in, not a component
      return: parentFiber,
    }
    ;(el as any).__reactFiber$xyz = childFiber
    const result = inspectReactComponent(el)
    expect(result!.name).toBe('AppLayout')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/content/react-inspector.test.ts
```

- [ ] **Step 3: Implement React inspector**

`src/content/react-inspector.ts`:
```typescript
interface ReactComponentInfo {
  name: string
  filePath?: string
}

export function inspectReactComponent(element: Element): ReactComponentInfo | null {
  // Walk up DOM tree looking for React fiber
  let el: Element | null = element
  while (el) {
    const fiber = getReactFiber(el)
    if (fiber) {
      const component = findUserComponent(fiber)
      if (component) return component
    }
    el = el.parentElement
  }
  return null
}

function getReactFiber(element: Element): any | null {
  const keys = Object.keys(element)
  for (const key of keys) {
    if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
      return (element as any)[key]
    }
  }
  return null
}

function findUserComponent(fiber: any): ReactComponentInfo | null {
  let current = fiber
  const maxDepth = 50 // safety limit

  for (let i = 0; i < maxDepth && current; i++) {
    if (current.type && typeof current.type !== 'string') {
      // This is a user-defined component (not a built-in like 'div')
      const name = current.type.displayName || current.type.name
      if (name) {
        const info: ReactComponentInfo = { name }
        if (current._debugSource) {
          info.filePath = current._debugSource.fileName
        }
        return info
      }
    }
    current = current.return
  }
  return null
}

export function detectVue(element: Element): boolean {
  let el: Element | null = element
  while (el) {
    if ((el as any).__VUE__ || (el as any).__vue__) {
      return true
    }
    el = el.parentElement
  }
  return false
}
```

- [ ] **Step 4: Run test**

```bash
bun test tests/content/react-inspector.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/content/react-inspector.ts tests/content/react-inspector.test.ts
git commit -m "feat: add React fiber inspector for opportunistic component name detection"
```

---

### Task 11: Content script coordinator

**Files:**
- Modify: `src/content/index.ts`

This wires up element selector, canvas overlay, cursor tracker, and React inspector into a single content script that responds to service worker messages.

- [ ] **Step 1: Implement content script coordinator**

`src/content/index.ts`:
```typescript
import { CanvasOverlay } from './canvas-overlay'
import { CursorTracker } from './cursor-tracker'
import { extractElementData, findNearestElement } from './element-selector'
import { inspectReactComponent } from './react-inspector'
import type { CaptureMode } from '@shared/messages'
import type { SelectedElementData } from '@shared/types'

// Use dynamic import of css-selector-generator to keep it tree-shakeable
let generateSelector: ((el: Element) => string) | null = null
import('css-selector-generator').then(mod => {
  generateSelector = mod.getCSSSelector || mod.default
}).catch(() => {
  // Fallback: simple selector
  generateSelector = (el: Element) => {
    if (el.id) return `#${el.id}`
    let path = el.tagName.toLowerCase()
    if (el.className && typeof el.className === 'string') {
      path += '.' + el.className.trim().split(/\s+/).join('.')
    }
    return path
  }
})

let overlay: CanvasOverlay | null = null
let cursorTracker: CursorTracker | null = null
let captureStartedAt = 0
let isCapturing = false
let currentMode: CaptureMode = 'select'

// Drawing state
let drawStart: { clientX: number; clientY: number } | null = null

function handleClick(e: MouseEvent) {
  if (!isCapturing || currentMode !== 'select') return

  e.preventDefault()
  e.stopPropagation()

  const element = findNearestElement(e.clientX, e.clientY, document)
  if (!element) return

  const selector = generateSelector ? generateSelector(element) : element.tagName.toLowerCase()
  const data = extractElementData(
    element,
    selector,
    window.getComputedStyle.bind(window),
    { scrollX: window.scrollX, scrollY: window.scrollY }
  )

  // Try React inspection
  const reactInfo = inspectReactComponent(element)
  if (reactInfo) {
    data.reactComponent = reactInfo
  }

  chrome.runtime.sendMessage({ type: 'ELEMENT_SELECTED', data })
}

function handleMouseDown(e: MouseEvent) {
  if (!isCapturing || currentMode === 'select' || !overlay) return
  drawStart = { clientX: e.clientX, clientY: e.clientY }
}

function handleMouseMove(e: MouseEvent) {
  if (!drawStart || !overlay) return
  if (currentMode === 'circle') {
    overlay.drawCirclePreview(drawStart, { clientX: e.clientX, clientY: e.clientY })
  } else if (currentMode === 'arrow') {
    overlay.drawArrowPreview(drawStart, { clientX: e.clientX, clientY: e.clientY })
  }
}

function handleMouseUp(e: MouseEvent) {
  if (!drawStart || !overlay) return

  const annotation = overlay.completeAnnotation(
    drawStart,
    { clientX: e.clientX, clientY: e.clientY },
    captureStartedAt,
    Date.now()
  )

  drawStart = null

  if (annotation) {
    // Resolve nearest element selector
    const centerX = annotation.type === 'circle'
      ? (annotation.coordinates as any).centerX - window.scrollX
      : (annotation.coordinates as any).endX - window.scrollX
    const centerY = annotation.type === 'circle'
      ? (annotation.coordinates as any).centerY - window.scrollY
      : (annotation.coordinates as any).endY - window.scrollY

    const nearestEl = findNearestElement(centerX, centerY, document)
    if (nearestEl && generateSelector) {
      annotation.nearestElement = generateSelector(nearestEl)
    }

    chrome.runtime.sendMessage({ type: 'ANNOTATION_ADDED', data: annotation })
  }
}

function startCapture() {
  captureStartedAt = Date.now()
  isCapturing = true
  currentMode = 'select'

  overlay = new CanvasOverlay(document, window)
  overlay.setMode('select')

  cursorTracker = new CursorTracker((batch) => {
    chrome.runtime.sendMessage({ type: 'CURSOR_BATCH', data: batch })
  })
  cursorTracker.start(captureStartedAt, document, window)

  document.addEventListener('click', handleClick, true)
  document.addEventListener('mousedown', handleMouseDown, true)
  document.addEventListener('mousemove', handleMouseMove, true)
  document.addEventListener('mouseup', handleMouseUp, true)
}

function stopCapture() {
  isCapturing = false

  document.removeEventListener('click', handleClick, true)
  document.removeEventListener('mousedown', handleMouseDown, true)
  document.removeEventListener('mousemove', handleMouseMove, true)
  document.removeEventListener('mouseup', handleMouseUp, true)

  if (cursorTracker) {
    const remaining = cursorTracker.stop()
    if (remaining.length > 0) {
      chrome.runtime.sendMessage({ type: 'CURSOR_BATCH', data: remaining })
    }
    cursorTracker = null
  }

  if (overlay) {
    overlay.destroy()
    overlay = null
  }
}

// Message listener
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'PING':
      sendResponse({ type: 'PONG' })
      break
    case 'INJECT_CAPTURE':
      startCapture()
      sendResponse({ ok: true })
      break
    case 'REMOVE_CAPTURE':
      stopCapture()
      sendResponse({ ok: true })
      break
    case 'MODE_CHANGED':
      currentMode = message.mode
      if (overlay) overlay.setMode(message.mode)
      sendResponse({ ok: true })
      break
  }
  return true
})
```

- [ ] **Step 2: Build and verify no compile errors**

```bash
bun build
```

- [ ] **Step 3: Commit**

```bash
git add src/content/
git commit -m "feat: wire up content script coordinator with element selector, canvas, cursor tracker, React inspector"
```

---

## Chunk 4: Sidepanel UI & Integration

### Task 12: Sidepanel capture controls and live feedback

**Files:**
- Modify: `src/sidepanel/App.tsx`
- Create: `src/sidepanel/components/CaptureControls.tsx`
- Create: `src/sidepanel/components/LiveFeedback.tsx`
- Create: `src/sidepanel/hooks/useCaptureSession.ts`
- Create: `src/sidepanel/styles.css`

- [ ] **Step 1: Create useCaptureSession hook**

`src/sidepanel/hooks/useCaptureSession.ts`:
```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import type { CaptureSession } from '@shared/types'
import type { CaptureMode, Message } from '@shared/messages'

type CaptureState = 'idle' | 'preparing' | 'capturing' | 'complete' | 'error'

export function useCaptureSession() {
  const [state, setState] = useState<CaptureState>('idle')
  const [session, setSession] = useState<CaptureSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const portRef = useRef<chrome.runtime.Port | null>(null)

  useEffect(() => {
    const listener = (message: Message) => {
      if (message.type === 'SESSION_UPDATED') {
        setSession(message.session)
        setState('capturing')
      } else if (message.type === 'CAPTURE_COMPLETE') {
        setSession(message.session)
        setState('complete')
      } else if (message.type === 'CAPTURE_ERROR') {
        setError(message.error)
        setState('error')
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const startCapture = useCallback(async () => {
    setState('preparing')
    setError(null)

    // Establish keep-alive port
    portRef.current = chrome.runtime.connect({ name: 'pointdev-keepalive' })
    portRef.current.onDisconnect.addListener(() => {
      // Service worker restarted — reconnect
      portRef.current = chrome.runtime.connect({ name: 'pointdev-keepalive' })
    })

    const response = await chrome.runtime.sendMessage({ type: 'START_CAPTURE' })
    if (response?.type === 'CAPTURE_ERROR') {
      setError(response.error)
      setState('error')
    } else if (response?.type === 'SESSION_UPDATED') {
      setSession(response.session)
      setState('capturing')
    }
  }, [])

  const stopCapture = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' })
    if (response?.type === 'CAPTURE_COMPLETE') {
      setSession(response.session)
      setState('complete')
    }
    portRef.current?.disconnect()
    portRef.current = null
  }, [])

  const setMode = useCallback((mode: CaptureMode) => {
    chrome.runtime.sendMessage({ type: 'SET_MODE', mode })
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setSession(null)
    setError(null)
  }, [])

  return { state, session, error, startCapture, stopCapture, setMode, reset }
}
```

- [ ] **Step 2: Create CaptureControls component**

`src/sidepanel/components/CaptureControls.tsx`:
```tsx
import { useState } from 'react'
import type { CaptureMode } from '@shared/messages'

interface CaptureControlsProps {
  isCapturing: boolean
  onStart: () => void
  onStop: () => void
  onModeChange: (mode: CaptureMode) => void
}

export function CaptureControls({ isCapturing, onStart, onStop, onModeChange }: CaptureControlsProps) {
  const [mode, setMode] = useState<CaptureMode>('select')

  const handleModeChange = (newMode: CaptureMode) => {
    setMode(newMode)
    onModeChange(newMode)
  }

  if (!isCapturing) {
    return (
      <button className="btn-primary" onClick={onStart}>
        Start Capture
      </button>
    )
  }

  return (
    <div className="capture-controls">
      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'select' ? 'active' : ''}`}
          onClick={() => handleModeChange('select')}
          title="Select element"
        >
          Select
        </button>
        <button
          className={`mode-btn ${mode === 'circle' ? 'active' : ''}`}
          onClick={() => handleModeChange('circle')}
          title="Draw circle"
        >
          &#9675;
        </button>
        <button
          className={`mode-btn ${mode === 'arrow' ? 'active' : ''}`}
          onClick={() => handleModeChange('arrow')}
          title="Draw arrow"
        >
          &#8594;
        </button>
      </div>
      <button className="btn-stop" onClick={onStop}>
        Stop Capture
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create LiveFeedback component**

`src/sidepanel/components/LiveFeedback.tsx`:
```tsx
import { useState, useEffect } from 'react'
import type { CaptureSession } from '@shared/types'

interface LiveFeedbackProps {
  session: CaptureSession | null
  isListening: boolean
  interimTranscript: string
  transcript: string
  captureStartedAt: number
}

export function LiveFeedback({ session, isListening, interimTranscript, transcript, captureStartedAt }: LiveFeedbackProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!captureStartedAt) return
    const interval = setInterval(() => {
      setElapsed(Date.now() - captureStartedAt)
    }, 1000)
    return () => clearInterval(interval)
  }, [captureStartedAt])

  const minutes = Math.floor(elapsed / 60000)
  const seconds = Math.floor((elapsed % 60000) / 1000)
  const timer = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="live-feedback">
      <div className="recording-indicator">
        <span className="recording-dot" /> Recording {timer}
      </div>

      {session?.selectedElement && (
        <div className="selected-element">
          <strong>Selected:</strong> {session.selectedElement.selector}
          {session.selectedElement.reactComponent && (
            <div className="component-name">
              Component: &lt;{session.selectedElement.reactComponent.name}&gt;
            </div>
          )}
        </div>
      )}

      {session && session.annotations.length > 0 && (
        <div className="annotations-list">
          <strong>Annotations:</strong> {session.annotations.length}
          {session.annotations.map((ann, i) => (
            <div key={i} className="annotation-item">
              {ann.type === 'circle' ? '○' : '→'} {ann.nearestElement || 'element'}
            </div>
          ))}
        </div>
      )}

      <div className="transcript-live">
        <strong>Transcript{isListening ? ' (live)' : ''}:</strong>
        <div className="transcript-text">
          {transcript}
          {interimTranscript && <span className="interim">{interimTranscript}</span>}
          {!transcript && !interimTranscript && (
            <span className="placeholder">Speak to add voice context...</span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create styles.css**

`src/sidepanel/styles.css`:
```css
:root {
  --bg: #ffffff;
  --text: #1a1a1a;
  --border: #e0e0e0;
  --accent: #2563eb;
  --danger: #dc2626;
  --muted: #6b7280;
  --code-bg: #f3f4f6;
  --radius: 6px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a1a;
    --text: #e5e5e5;
    --border: #333333;
    --accent: #3b82f6;
    --danger: #ef4444;
    --muted: #9ca3af;
    --code-bg: #2a2a2a;
  }
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 13px;
  color: var(--text);
  background: var(--bg);
  padding: 12px;
  line-height: 1.5;
}

.header { font-size: 16px; font-weight: 600; margin-bottom: 12px; }

.btn-primary {
  width: 100%;
  padding: 10px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-size: 14px;
  cursor: pointer;
}

.btn-stop {
  width: 100%;
  padding: 10px;
  background: var(--danger);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-size: 14px;
  cursor: pointer;
  margin-top: 8px;
}

.mode-toggle {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.mode-btn {
  flex: 1;
  padding: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 13px;
}

.mode-btn.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-weight: 500;
}

.recording-dot {
  width: 8px;
  height: 8px;
  background: var(--danger);
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.selected-element, .annotations-list, .transcript-live {
  margin-bottom: 10px;
  padding: 8px;
  background: var(--code-bg);
  border-radius: var(--radius);
  font-size: 12px;
}

.component-name { color: var(--accent); font-size: 11px; }
.annotation-item { padding-left: 12px; color: var(--muted); }
.transcript-text { margin-top: 4px; }
.interim { color: var(--muted); }
.placeholder { color: var(--muted); font-style: italic; }

code, .selector { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11px; }

.output-view {
  background: var(--code-bg);
  border-radius: var(--radius);
  padding: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  line-height: 1.6;
}

.btn-copy {
  width: 100%;
  padding: 10px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-size: 14px;
  cursor: pointer;
  margin-top: 8px;
}

.btn-back {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.copied-feedback {
  text-align: center;
  color: var(--accent);
  font-size: 12px;
  margin-top: 4px;
}

.error-message {
  padding: 12px;
  background: #fef2f2;
  color: var(--danger);
  border-radius: var(--radius);
  margin-bottom: 12px;
}

.preparing { color: var(--muted); text-align: center; padding: 20px; }
```

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/
git commit -m "feat: add sidepanel capture controls, live feedback, and styles"
```

---

### Task 13: Output view and copy-to-clipboard

**Files:**
- Create: `src/sidepanel/components/OutputView.tsx`
- Create: `src/sidepanel/components/CopyButton.tsx`

- [ ] **Step 1: Create OutputView**

`src/sidepanel/components/OutputView.tsx`:
```tsx
import { useMemo } from 'react'
import type { CaptureSession } from '@shared/types'
import { formatSession } from '@shared/formatter'
import { computeDwells } from '@shared/dwell'
import { CopyButton } from './CopyButton'

interface OutputViewProps {
  session: CaptureSession
  onBack: () => void
}

export function OutputView({ session, onBack }: OutputViewProps) {
  const output = useMemo(() => {
    // Compute dwells before formatting
    const dwells = computeDwells(session.cursorTrace)
    const sessionWithDwells = {
      ...session,
      cursorTrace: dwells.length > 0
        ? [...session.cursorTrace.filter(s => s.dwellMs != null), ...dwells]
        : session.cursorTrace,
    }
    return formatSession(sessionWithDwells)
  }, [session])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span className="header">PointDev</span>
        <button className="btn-back" onClick={onBack}>&#8592; Back</button>
      </div>
      <div className="output-view">{output}</div>
      <CopyButton text={output} />
    </div>
  )
}
```

- [ ] **Step 2: Create CopyButton**

`src/sidepanel/components/CopyButton.tsx`:
```tsx
import { useState, useCallback } from 'react'

interface CopyButtonProps {
  text: string
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [text])

  return (
    <div>
      <button className="btn-copy" onClick={handleCopy}>
        {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
      </button>
      {copied && <div className="copied-feedback">Paste into your AI coding tool</div>}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/components/OutputView.tsx src/sidepanel/components/CopyButton.tsx
git commit -m "feat: add output view with template formatter rendering and copy-to-clipboard"
```

---

### Task 14: Wire up App.tsx

**Files:**
- Modify: `src/sidepanel/App.tsx`

- [ ] **Step 1: Implement full App component**

`src/sidepanel/App.tsx`:
```tsx
import { useRef, useEffect } from 'react'
import { useCaptureSession } from './hooks/useCaptureSession'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { CaptureControls } from './components/CaptureControls'
import { LiveFeedback } from './components/LiveFeedback'
import { OutputView } from './components/OutputView'
import './styles.css'

export function App() {
  const { state, session, error, startCapture, stopCapture, setMode, reset } = useCaptureSession()
  const speech = useSpeechRecognition()
  const captureStartRef = useRef(0)

  // Send transcript updates incrementally as segments arrive
  const lastSegmentCountRef = useRef(0)
  useEffect(() => {
    if (state !== 'capturing') return
    if (speech.segments.length > lastSegmentCountRef.current) {
      const newSegment = speech.segments[speech.segments.length - 1]
      chrome.runtime.sendMessage({
        type: 'TRANSCRIPT_UPDATE',
        data: { transcript: speech.transcript, segment: newSegment },
      })
      lastSegmentCountRef.current = speech.segments.length
    }
  }, [speech.segments, speech.transcript, state])

  const handleStart = async () => {
    captureStartRef.current = Date.now()
    lastSegmentCountRef.current = 0
    await startCapture()
    if (speech.isAvailable) {
      speech.start(captureStartRef.current)
    }
  }

  const handleStop = async () => {
    speech.stop()
    await stopCapture()
  }

  if (state === 'complete' && session) {
    // Empty capture detection
    const hasContent = session.selectedElement || session.annotations.length > 0 ||
      (session.voiceRecording && session.voiceRecording.segments.length > 0)
    if (!hasContent) {
      return (
        <div>
          <div className="header">PointDev</div>
          <div className="error-message">
            No context captured. Try selecting an element or recording your voice.
          </div>
          <button className="btn-primary" onClick={reset}>Try Again</button>
        </div>
      )
    }
    return <OutputView session={session} onBack={reset} />
  }

  return (
    <div>
      <div className="header">PointDev</div>

      {state === 'error' && error && (
        <div className="error-message">{error}</div>
      )}

      {state === 'preparing' && (
        <div className="preparing">Preparing capture...</div>
      )}

      {!speech.isAvailable && state === 'idle' && (
        <div className="error-message">
          Voice capture unavailable. Other capture features will still work.
        </div>
      )}

      {speech.error && (
        <div className="error-message">{speech.error}</div>
      )}

      <CaptureControls
        isCapturing={state === 'capturing'}
        onStart={handleStart}
        onStop={handleStop}
        onModeChange={setMode}
      />

      {state === 'capturing' && (
        <LiveFeedback
          session={session}
          isListening={speech.isListening}
          interimTranscript={speech.interimTranscript}
          transcript={speech.transcript}
          captureStartedAt={captureStartRef.current}
        />
      )}

      {state === 'idle' && (
        <div style={{ marginTop: 16, color: 'var(--muted)', fontSize: 12 }}>
          Click Start Capture, then talk, draw, and click on the page to capture structured context.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build and verify**

```bash
bun build
```
Expected: builds without errors.

- [ ] **Step 3: Manual integration test**

Load unpacked in Chrome. Open any webpage. Open sidepanel. Test full flow:
1. Click Start Capture
2. Click an element — verify selector appears in sidepanel
3. Switch to Circle mode, draw a circle — verify annotation count increases
4. Switch to Arrow mode, draw an arrow — verify annotation count increases
5. Speak — verify transcript appears live
6. Click Stop Capture — verify compiled output appears
7. Click Copy to Clipboard — verify clipboard content is the structured prompt

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/App.tsx
git commit -m "feat: wire up full sidepanel app with capture flow, voice, and output view"
```

---

### Task 15: Final polish and README

**Files:**
- Copy: `docs/README-draft.md` → `README.md`
- Copy: `docs/CONTRIBUTING-draft.md` → `CONTRIBUTING.md`
- Create: `LICENSE`

- [ ] **Step 1: Copy README and CONTRIBUTING**

```bash
cp docs/README-draft.md README.md
cp docs/CONTRIBUTING-draft.md CONTRIBUTING.md
```

- [ ] **Step 2: Create MIT LICENSE**

`LICENSE`:
```
MIT License

Copyright (c) 2026 Almost a Lab S.L.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Run all tests**

```bash
bun test
```
Expected: all tests pass.

- [ ] **Step 4: Final build**

```bash
bun build
```
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add README.md CONTRIBUTING.md LICENSE
git commit -m "docs: add README, CONTRIBUTING guide, and MIT license"
```

- [ ] **Step 6: Update development log**

Append a session entry to `docs/genai-disclosure/development-log.md` documenting this implementation session per CLAUDE.md rules.

- [ ] **Step 7: Create GitHub repository and push**

```bash
git remote add origin https://github.com/almostalab/pointdev.git
git push -u origin main
```
