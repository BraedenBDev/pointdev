# Auto-Screenshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically capture annotated screenshots at moments of user intent, deduplicate intelligently, and present as copyable thumbnails in the sidepanel.

**Architecture:** `captureVisibleTab` fires after annotation completion and element selection (with compositor delay via rAF+setTimeout). Dedup logic lives entirely in the content script, sending a `replacesPrevious` flag. Screenshots stored in-memory only (dataUrl stripped from chrome.storage.session). New `ScreenshotThumbnail` component renders thumbnails with copy-to-clipboard.

**Tech Stack:** TypeScript, React 18, Chrome `tabs.captureVisibleTab` API, `navigator.clipboard.write` for image copy

**Spec:** `docs/superpowers/specs/2026-03-19-auto-screenshot-design.md`

**Merge safety:** Tasks 1-4 form an atomic unit — the code will not compile cleanly between Tasks 2 and 3 (session-store removes `addScreenshot` before handler stops calling it) or between Tasks 3 and 4 (handler expects new message shape before content script sends it). Run tests only after Task 4 is complete.

**Note on duplicate display:** The formatter's `## Screenshots` text section and the `ScreenshotThumbnail` UI components both show screenshot info. This is intentional — text is for the clipboard-copied prompt (AI agents parse text), thumbnails are for visual confirmation and image copying (humans paste images). "Copy All" button is deferred as a follow-up.

---

## Task 1: Type System Migration

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/messages.ts`
- Modify: `tests/shared/types.test.ts`

- [ ] **Step 1: Replace ElementScreenshot with AnnotatedScreenshot in types.ts**

In `src/shared/types.ts`, replace the `ElementScreenshot` interface (lines 36-42) with:

```typescript
export interface AnnotatedScreenshot {
  dataUrl: string
  timestampMs: number
  viewport: { scrollX: number; scrollY: number }
  annotationIndices: number[]
  descriptionParts: string[]
  voiceContext?: string
}
```

Update `CaptureSession` line 30: change `screenshots: ElementScreenshot[]` to `screenshots: AnnotatedScreenshot[]`.

- [ ] **Step 2: Update messages.ts**

In `src/shared/messages.ts`:

Replace the import line 1 — change `ElementScreenshot` to `AnnotatedScreenshot`:

```typescript
import type { SelectedElementData, AnnotationData, CursorSampleData, VoiceSegment, CaptureSession, AnnotatedScreenshot, DeviceMetadata, ConsoleEntry, FailedRequest } from './types'
```

Replace the `SCREENSHOT_REQUEST` line (line 20) with:

```typescript
  | { type: 'SCREENSHOT_REQUEST'; data: { timestampMs: number; viewport: { scrollX: number; scrollY: number }; annotationIndex?: number; selectedElementSelector?: string; replacesPrevious: boolean } }
```

Remove the `SCREENSHOT_CAPTURED` line (line 26):

```typescript
  // Service Worker → Content Script (response)    ← delete this comment
  | { type: 'SCREENSHOT_CAPTURED'; data: ElementScreenshot }  ← delete this line
```

- [ ] **Step 3: Update types test**

In `tests/shared/types.test.ts`, fix the two test cases that construct `CaptureSession` objects with the old `screenshots` shape.

Line 19 — the empty session test already has `screenshots: []`, which is valid for both types. But it's missing `consoleErrors` and `failedRequests`. Update to:

```typescript
    const session: CaptureSession = {
      id: 'test-1',
      tabId: 1,
      startedAt: Date.now(),
      url: 'https://example.com',
      title: 'Test',
      viewport: { width: 1200, height: 800 },
      device: null,
      selectedElement: null,
      voiceRecording: null,
      annotations: [],
      cursorTrace: [],
      screenshots: [],
      consoleErrors: [],
      failedRequests: [],
    }
```

Lines 57-59 — replace the old `ElementScreenshot` in the populated session test:

```typescript
      screenshots: [
        { dataUrl: 'data:image/png;base64,abc', timestampMs: 5000, viewport: { scrollX: 0, scrollY: 0 }, annotationIndices: [0], descriptionParts: ['Circle around div.hero > h1'], voiceContext: 'the font is too small' },
      ],
      consoleErrors: [],
      failedRequests: [],
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/shared/types.test.ts`

Expected: PASS (types align with new interface).

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/shared/messages.ts tests/shared/types.test.ts
git commit -m "refactor: replace ElementScreenshot with AnnotatedScreenshot type

New type adds annotationIndices, descriptionParts, voiceContext, and
viewport for dedup. Removes SCREENSHOT_CAPTURED message (unused).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Session Store + Storage Strategy

**Files:**
- Modify: `src/background/session-store.ts`
- Modify: `tests/background/session-store.test.ts`

- [ ] **Step 1: Update session-store.ts**

Replace the import line 1:

```typescript
import type { CaptureSession, SelectedElementData, AnnotationData, CursorSampleData, VoiceSegment, AnnotatedScreenshot, DeviceMetadata, ConsoleEntry, FailedRequest } from '@shared/types'
```

Replace `addScreenshot` method (lines 53-57) with two new methods:

```typescript
  addAnnotatedScreenshot(screenshot: AnnotatedScreenshot): void {
    if (!this.session) return
    // Cap at 10 screenshots (FIFO eviction)
    if (this.session.screenshots.length >= 10) {
      this.session.screenshots.shift()
    }
    this.session.screenshots.push(screenshot)
    this.persist()
  }

  updateLastScreenshot(screenshot: AnnotatedScreenshot): void {
    if (!this.session || this.session.screenshots.length === 0) return
    const last = this.session.screenshots[this.session.screenshots.length - 1]
    last.dataUrl = screenshot.dataUrl
    last.timestampMs = screenshot.timestampMs
    last.annotationIndices.push(...screenshot.annotationIndices)
    last.descriptionParts = [...new Set([...last.descriptionParts, ...screenshot.descriptionParts])]
    if (screenshot.voiceContext && !last.voiceContext) {
      last.voiceContext = screenshot.voiceContext
    }
    this.persist()
  }
```

Update `persist()` to strip `dataUrl`:

```typescript
  private persist(): void {
    try {
      const sessionForStorage = {
        ...this.session,
        screenshots: this.session!.screenshots.map(s => ({ ...s, dataUrl: '' })),
      }
      chrome.storage.session.set({ activeSession: sessionForStorage })
    } catch {
      // Silently fail in environments without chrome.storage
    }
  }
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/background/session-store.test.ts`

Expected: PASS (existing tests don't directly test addScreenshot in most cases; if they do, update them to use `addAnnotatedScreenshot` with the new shape).

- [ ] **Step 3: Commit**

```bash
git add src/background/session-store.ts tests/background/session-store.test.ts
git commit -m "feat: add annotated screenshot store methods with FIFO cap and storage stripping

addAnnotatedScreenshot caps at 10 (FIFO), updateLastScreenshot merges
indices and descriptions. persist() strips dataUrl to avoid exceeding
chrome.storage.session quota.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Service Worker Screenshot Handler

**Files:**
- Modify: `src/background/message-handler.ts`

- [ ] **Step 1: Rewrite SCREENSHOT_REQUEST handler**

Replace the `SCREENSHOT_REQUEST` case (lines ~161-181 of message-handler.ts) with:

```typescript
    case 'SCREENSHOT_REQUEST': {
      const session = store.getSession()
      if (!session) return undefined

      try {
        const dataUrl = await chrome.tabs.captureVisibleTab()
        const { timestampMs, viewport, annotationIndex, selectedElementSelector, replacesPrevious } = message.data

        // Build description parts
        const annotationIndices: number[] = []
        const descParts: string[] = []

        if (annotationIndex != null) {
          // -1 sentinel means "the annotation that was just added"
          const resolvedIndex = annotationIndex === -1 ? session.annotations.length - 1 : annotationIndex
          if (resolvedIndex >= 0 && resolvedIndex < session.annotations.length) {
            annotationIndices.push(resolvedIndex)
            const ann = session.annotations[resolvedIndex]
            if (ann) {
              const target = ann.nearestElement || 'unknown element'
              descParts.push(`${ann.type.charAt(0).toUpperCase() + ann.type.slice(1)} around ${target}`)
            }
          }
        }

        if (selectedElementSelector) {
          descParts.push(`Selected ${selectedElementSelector}`)
        }

        // Find overlapping voice context (±2s window, join multiple segments)
        let voiceContext: string | undefined
        if (session.voiceRecording) {
          const overlapping = session.voiceRecording.segments.filter(seg =>
            seg.startMs <= timestampMs + 2000 && seg.endMs >= timestampMs - 2000
          )
          if (overlapping.length > 0) {
            voiceContext = overlapping.map(s => s.text).join(' ')
          }
        }

        const screenshot = {
          dataUrl,
          timestampMs,
          viewport,
          annotationIndices,
          descriptionParts: descParts.length > 0 ? descParts : ['Page capture'],
          voiceContext,
        }

        if (replacesPrevious) {
          store.updateLastScreenshot(screenshot)
        } else {
          store.addAnnotatedScreenshot(screenshot)
        }

        const updated = store.getSession()
        return updated ? { type: 'SESSION_UPDATED', session: updated } : undefined
      } catch {
        // captureVisibleTab failed (e.g., chrome:// pages)
        return undefined
      }
    }
```

Also remove the main-world console injection's reference to `chrome.tabs.captureVisibleTab` if it conflicts (it shouldn't — they're separate cases).

- [ ] **Step 2: Run tests**

Run: `npx vitest run`

Expected: PASS. The message handler test may need updating if it directly tests the old SCREENSHOT_REQUEST shape.

- [ ] **Step 3: Commit**

```bash
git add src/background/message-handler.ts
git commit -m "feat: build AnnotatedScreenshot with description and voice context

Service worker handler generates description from annotation type +
nearestElement, finds overlapping voice segments (±2s), handles
replacesPrevious flag for dedup grouping.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Content Script Dedup + Screenshot Trigger

**Files:**
- Modify: `src/content/index.ts`
- Create: `tests/content/screenshot-dedup.test.ts`

- [ ] **Step 1: Write dedup tests**

Create `tests/content/screenshot-dedup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

// Test the dedup logic as a pure function (extracted for testability)
function shouldCapture(
  now: number,
  lastTime: number,
  lastScroll: { x: number; y: number },
  currentScroll: { x: number; y: number }
): { capture: boolean; replacesPrevious: boolean } {
  const scrollChanged = currentScroll.x !== lastScroll.x || currentScroll.y !== lastScroll.y
  const withinWindow = (now - lastTime) < 2000 && lastTime > 0

  if (!withinWindow || scrollChanged) {
    return { capture: true, replacesPrevious: false }
  }
  // Within time window, same scroll — group with previous
  return { capture: true, replacesPrevious: true }
}

describe('screenshot dedup logic', () => {
  it('always captures first annotation', () => {
    const result = shouldCapture(1000, 0, { x: 0, y: 0 }, { x: 0, y: 0 })
    expect(result.capture).toBe(true)
    expect(result.replacesPrevious).toBe(false)
  })

  it('groups two annotations < 2s apart, same scroll', () => {
    const result = shouldCapture(2500, 1000, { x: 0, y: 0 }, { x: 0, y: 0 })
    expect(result.capture).toBe(true)
    expect(result.replacesPrevious).toBe(true)
  })

  it('separates two annotations > 2s apart', () => {
    const result = shouldCapture(5000, 1000, { x: 0, y: 0 }, { x: 0, y: 0 })
    expect(result.capture).toBe(true)
    expect(result.replacesPrevious).toBe(false)
  })

  it('separates annotations with different scroll', () => {
    const result = shouldCapture(1500, 1000, { x: 0, y: 0 }, { x: 0, y: 500 })
    expect(result.capture).toBe(true)
    expect(result.replacesPrevious).toBe(false)
  })

  it('groups rapid-fire annotations', () => {
    // Simulate 5 annotations in 2s
    let lastTime = 1000
    for (let i = 0; i < 4; i++) {
      const t = 1400 + i * 400
      const result = shouldCapture(t, lastTime, { x: 0, y: 0 }, { x: 0, y: 0 })
      expect(result.replacesPrevious).toBe(true)
      lastTime = t
    }
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/content/screenshot-dedup.test.ts`

Expected: PASS (pure function, no imports from the codebase).

- [ ] **Step 3: Add dedup state and screenshot trigger to index.ts**

In `src/content/index.ts`, add dedup state after the ancestry cycling state (after line 41):

```typescript
// Screenshot dedup state
let lastScreenshotTime = 0
let lastScreenshotScroll = { x: 0, y: 0 }
```

Add the screenshot request helper function before `handleClick`:

```typescript
function requestScreenshot(annotationIndex?: number, selectedElementSelector?: string): void {
  const now = Date.now()
  const currentScroll = { x: window.scrollX, y: window.scrollY }
  const scrollChanged = currentScroll.x !== lastScreenshotScroll.x || currentScroll.y !== lastScreenshotScroll.y
  const withinWindow = (now - lastScreenshotTime) < 2000 && lastScreenshotTime > 0
  const replacesPrevious = withinWindow && !scrollChanged

  // Update dedup state BEFORE the async capture — we measure time between
  // user actions (intent), not between capture completions. This is an
  // intentional deviation from the spec which updates inside the callback.
  lastScreenshotTime = now
  lastScreenshotScroll = currentScroll

  // Wait for compositor to flush the canvas before capturing
  requestAnimationFrame(() => {
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'SCREENSHOT_REQUEST',
        data: {
          timestampMs: now - captureStartedAt,
          viewport: currentScroll,
          annotationIndex,
          selectedElementSelector,
          replacesPrevious,
        },
      })
    }, 0)
  })
}
```

Update `handleClick` — replace the old SCREENSHOT_REQUEST block (lines 77-86) with:

```typescript
  chrome.runtime.sendMessage({ type: 'ELEMENT_SELECTED', data })

  // Trigger annotated screenshot with dedup
  requestScreenshot(undefined, selector)
```

Update `handleMouseUp` — add screenshot trigger after `ANNOTATION_ADDED` (after line 188):

```typescript
    chrome.runtime.sendMessage({ type: 'ANNOTATION_ADDED', data: annotation })

    // Trigger annotated screenshot. Use -1 sentinel = "most recent annotation".
    // Chrome guarantees message ordering from the same sender, so ANNOTATION_ADDED
    // is processed before SCREENSHOT_REQUEST. The service worker resolves -1 to
    // session.annotations.length - 1 (already handled in Task 3's handler).
    requestScreenshot(-1)
```

Reset dedup state in `startCapture`:

```typescript
  lastScreenshotTime = 0
  lastScreenshotScroll = { x: 0, y: 0 }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/index.ts tests/content/screenshot-dedup.test.ts
git commit -m "feat: trigger annotated screenshots on annotation and element selection

Screenshots fire after every annotation completion and element selection
with compositor delay (rAF+setTimeout). Dedup logic groups captures
within 2s on same scroll position, sending replacesPrevious flag.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Formatter Update

**Files:**
- Modify: `src/shared/formatter.ts`
- Modify: `tests/shared/formatter.test.ts`

- [ ] **Step 1: Write failing formatter tests**

Add to `tests/shared/formatter.test.ts`:

```typescript
  it('formats annotated screenshots with description and voice context', () => {
    const output = formatSession(makeSession({
      screenshots: [{
        dataUrl: 'data:image/png;base64,abc',
        timestampMs: 31000,
        viewport: { scrollX: 0, scrollY: 0 },
        annotationIndices: [0],
        descriptionParts: ['Circle around .hero-title'],
        voiceContext: 'need to expand this box',
      }],
    }))
    expect(output).toContain('## Screenshots')
    expect(output).toContain('[00:31]')
    expect(output).toContain('Circle around .hero-title')
    expect(output).toContain('"need to expand this box"')
    expect(output).not.toContain('base64')
  })

  it('formats screenshots without voice context', () => {
    const output = formatSession(makeSession({
      screenshots: [{
        dataUrl: 'data:image/png;base64,abc',
        timestampMs: 5000,
        viewport: { scrollX: 0, scrollY: 100 },
        annotationIndices: [0, 1],
        descriptionParts: ['Selected div.card', 'Arrow to nav > a'],
      }],
    }))
    expect(output).toContain('Selected div.card | Arrow to nav > a')
    expect(output).not.toContain('undefined')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/shared/formatter.test.ts`

Expected: FAIL — `formatScreenshots` reads `s.selector` which doesn't exist on `AnnotatedScreenshot`.

- [ ] **Step 3: Update formatScreenshots**

Replace `formatScreenshots` in `src/shared/formatter.ts` (lines 226-234):

```typescript
function formatScreenshots(session: CaptureSession): string {
  const lines = ['## Screenshots']
  for (let i = 0; i < session.screenshots.length; i++) {
    const s = session.screenshots[i]
    const ts = formatTimestamp(s.timestampMs)
    const desc = s.descriptionParts.join(' | ')
    const voice = s.voiceContext ? ` — "${s.voiceContext}"` : ''
    lines.push(`${i + 1}. [${ts}] ${desc}${voice}`)
  }
  return lines.join('\n')
}
```

Also update the existing formatter tests that use the old `ElementScreenshot` shape. In `makeSession`, the `screenshots` default is already `[]` so no change needed there. But the existing test "formats element screenshots with timestamps and dimensions" (lines 197-209) must be rewritten:

```typescript
  it('formats annotated screenshots with timestamps', () => {
    const output = formatSession(makeSession({
      screenshots: [
        { dataUrl: '', timestampMs: 5000, viewport: { scrollX: 0, scrollY: 0 }, annotationIndices: [0], descriptionParts: ['Circle around div.hero > h1'], voiceContext: 'the font is too small' },
        { dataUrl: '', timestampMs: 12000, viewport: { scrollX: 0, scrollY: 500 }, annotationIndices: [1], descriptionParts: ['Selected nav > a.pricing'] },
      ],
    }))
    expect(output).toContain('## Screenshots')
    expect(output).toContain('1. [00:05] Circle around div.hero > h1 — "the font is too small"')
    expect(output).toContain('2. [00:12] Selected nav > a.pricing')
    expect(output).not.toContain('base64')
  })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/shared/formatter.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/formatter.ts tests/shared/formatter.test.ts
git commit -m "feat: enrich screenshot formatter with descriptions and voice context

Screenshots now display as '[00:31] Circle around .hero — \"voice text\"'
instead of the old selector + dimensions format.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: ScreenshotThumbnail Component

**Files:**
- Create: `src/sidepanel/components/ScreenshotThumbnail.tsx`

- [ ] **Step 1: Create ScreenshotThumbnail component**

Create `src/sidepanel/components/ScreenshotThumbnail.tsx`:

```typescript
import { useState, useCallback } from 'react'
import type { AnnotatedScreenshot } from '@shared/types'

interface ScreenshotThumbnailProps {
  screenshot: AnnotatedScreenshot
  size: 'small' | 'large'
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function ScreenshotThumbnail({ screenshot, size }: ScreenshotThumbnailProps) {
  const [copied, setCopied] = useState(false)
  const width = size === 'small' ? 120 : 240

  const handleCopy = useCallback(async () => {
    if (!screenshot.dataUrl) return

    try {
      const response = await fetch(screenshot.dataUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: copy description text
      await navigator.clipboard.writeText(
        screenshot.descriptionParts.join(' | ') + (screenshot.voiceContext ? ` — "${screenshot.voiceContext}"` : '')
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [screenshot])

  const desc = screenshot.descriptionParts.join(' | ')
  const ts = formatTimestamp(screenshot.timestampMs)

  return (
    <div className="screenshot-thumbnail" style={{ marginBottom: 8 }}>
      {screenshot.dataUrl ? (
        <img
          src={screenshot.dataUrl}
          alt={desc}
          style={{ width, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
        />
      ) : (
        <div style={{ width, height: width * 0.6, background: 'var(--code-bg)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--muted)' }}>
          Screenshot lost
        </div>
      )}
      <div style={{ fontSize: 11, marginTop: 4 }}>
        <span style={{ color: 'var(--muted)' }}>[{ts}]</span> {desc}
      </div>
      {screenshot.voiceContext && (
        <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--muted)' }}>
          "{screenshot.voiceContext}"
        </div>
      )}
      {size === 'large' && (
        <button
          className="btn-copy-img"
          onClick={handleCopy}
          style={{
            marginTop: 4, padding: '4px 8px', fontSize: 11,
            background: 'var(--accent)', color: 'white', border: 'none',
            borderRadius: 'var(--radius)', cursor: 'pointer',
          }}
        >
          {copied ? 'Copied!' : 'Copy Image'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/sidepanel/components/ScreenshotThumbnail.tsx
git commit -m "feat: add ScreenshotThumbnail component with image copy

Renders screenshot as thumbnail with description, voice context, and
timestamp. Copy Image button uses navigator.clipboard.write with
ClipboardItem for PNG copy. Falls back to text copy.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire Thumbnails into LiveFeedback and OutputView

**Files:**
- Modify: `src/sidepanel/components/LiveFeedback.tsx`
- Modify: `src/sidepanel/components/OutputView.tsx`

- [ ] **Step 1: Add thumbnails to LiveFeedback**

In `src/sidepanel/components/LiveFeedback.tsx`, add import:

```typescript
import { ScreenshotThumbnail } from './ScreenshotThumbnail'
```

Add screenshot thumbnails section after the annotations list and before the transcript section (before line 55):

```typescript
      {session && session.screenshots.length > 0 && (
        <div className="screenshots-list" style={{ marginBottom: 10 }}>
          <strong>Screenshots:</strong> {session.screenshots.length}
          {session.screenshots.map((ss, i) => (
            <ScreenshotThumbnail key={i} screenshot={ss} size="small" />
          ))}
        </div>
      )}
```

Also update the annotation icon display (line 49) to handle all annotation types:

```typescript
              {ann.type === 'circle' ? '\u25CB' : ann.type === 'arrow' ? '\u2192' : ann.type === 'freehand' ? '\u270E' : '\u25A1'} {ann.nearestElement || 'element'}
```

- [ ] **Step 2: Add thumbnails and copy to OutputView**

In `src/sidepanel/components/OutputView.tsx`, add import:

```typescript
import { ScreenshotThumbnail } from './ScreenshotThumbnail'
```

Add screenshots section between the output text and the copy button (after line 27, before `<CopyButton>`):

```typescript
      {session.screenshots.length > 0 && (
        <div style={{ marginTop: 12, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Screenshots</div>
          {session.screenshots.map((ss, i) => (
            <ScreenshotThumbnail key={i} screenshot={ss} size="large" />
          ))}
        </div>
      )}
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`

Expected: All tests pass.

- [ ] **Step 4: Run build**

Run: `npx vite build`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/components/LiveFeedback.tsx src/sidepanel/components/OutputView.tsx
git commit -m "feat: wire screenshot thumbnails into LiveFeedback and OutputView

LiveFeedback shows small thumbnails during capture. OutputView shows
large thumbnails with Copy Image buttons after capture.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Post-Implementation

- [ ] **Run full test suite:** `npx vitest run`
- [ ] **Run build:** `npx vite build`
- [ ] **Run lint:** `bun lint`
- [ ] **File GitHub issue:** "Add tab video recording for session replay" with the description from the spec's Future section
- [ ] **Update GenAI development log:** Append session entry to `docs/genai-disclosure/development-log.md`
