# Auto-Screenshot with Annotation Context

> Automatically capture annotated screenshots at moments of user intent, deduplicate intelligently, and present as copyable thumbnails in the sidepanel.

## Problem

Currently, screenshots only fire on element selection (click in select mode). Annotations (circle, arrow, freehand, rectangle) produce no screenshot. The user's drawn annotations — the most expressive part of their feedback — have no visual record. The existing `ElementScreenshot` stores a full viewport PNG but the formatter drops the image data entirely.

## Solution

Trigger `captureVisibleTab` after every annotation completion and element selection. Since the canvas overlay is in the DOM, `captureVisibleTab` includes drawn annotations. Deduplicate redundant captures, enrich each screenshot with annotation descriptions and voice context, and present as thumbnails with copy-to-clipboard buttons in the sidepanel.

No new permissions required — `activeTab` + `captureVisibleTab` is sufficient.

**Compositing timing:** The canvas `redraw()` executes synchronously before `handleMouseUp` returns. However, the browser compositor may not have flushed the canvas to screen before `captureVisibleTab` fires (it captures what is composited, not what is in the DOM). To mitigate this race condition, the content script waits one `requestAnimationFrame` + `setTimeout(0)` before sending `SCREENSHOT_REQUEST`, giving the compositor time to flush.

---

## Deduplication Logic

**WARNING: This is a likely failure vector. Test aggressively with edge cases.**

**All dedup logic lives in the content script** (single source of truth, no split-brain with service worker).

Three rules prevent redundant screenshots:

1. **Time window (2s):** If the last screenshot was taken < 2 seconds ago AND the viewport hasn't scrolled, this is a grouped capture. Send `SCREENSHOT_REQUEST` with `replacesPrevious: true` — the service worker replaces the last screenshot (which now has all annotations composited).
2. **Viewport change:** Track `scrollX/scrollY` at each capture. If scroll position changed since last screenshot, always capture as a new screenshot (different page region).
3. **First annotation:** The first annotation in a capture session always triggers a screenshot (no dedup needed).

**Edge cases to test:**
- Two annotations 0.5s apart, same scroll → one screenshot (second replaces first, both annotation indices)
- Two annotations 3s apart, same scroll → two separate screenshots
- Two annotations 1s apart, different scroll → two separate screenshots (viewport changed)
- Annotation then element selection 1s apart → screenshot replaces with both contexts
- Rapid-fire 5 annotations in 2s → one screenshot covering all 5
- Annotation after long pause (10s+) → always new screenshot
- Single annotation only → always captured (no dedup needed)
- Compositor race: annotation drawn but screenshot captured before flush → rAF+setTimeout mitigates

---

## Data Model

Replace `ElementScreenshot` with `AnnotatedScreenshot`:

```typescript
export interface AnnotatedScreenshot {
  dataUrl: string
  timestampMs: number
  viewport: { scrollX: number; scrollY: number }
  annotationIndices: number[]
  descriptionParts: string[]         // stored as array, joined for display
  voiceContext?: string
}
```

### Fields

- **`dataUrl`**: Full viewport PNG from `captureVisibleTab`. Includes the canvas overlay with all annotations drawn at capture time. **Not persisted to `chrome.storage.session`** — stored in-memory only (see Storage section).
- **`timestampMs`**: Session-relative timestamp (`Date.now() - captureStartedAt`).
- **`viewport`**: Scroll position at capture time. Used for deduplication comparison.
- **`annotationIndices`**: Indices into `session.annotations[]` that are visible in this screenshot.
- **`descriptionParts`**: Array of description strings (e.g., `["Circle around .hero-title", "Arrow to nav > a"]`). Stored as array to avoid fragile string splitting on join. Displayed as `descriptionParts.join(' | ')`.
- **`voiceContext`**: Text from any voice segment whose timestamp range overlaps the screenshot's timestamp (±2s window). Multiple overlapping segments are joined with spaces.

### Session changes

```typescript
export interface CaptureSession {
  // ... existing fields ...
  screenshots: AnnotatedScreenshot[]  // was ElementScreenshot[]
}
```

`ElementScreenshot` is removed. `createEmptySession` unchanged (already initializes `screenshots: []`).

---

## Storage Strategy

**Problem:** `chrome.storage.session` has a 1 MB default quota (10 MB with `setAccessLevel`). A single viewport PNG is 1-4 MB base64-encoded. Storing multiple screenshots in session storage will exceed quota.

**Solution:** Screenshots are stored in two tiers:

1. **In-memory** (service worker `SessionStore`): Full `AnnotatedScreenshot` objects with `dataUrl`. Available for the sidepanel to display thumbnails via `SESSION_UPDATED` messages.
2. **`chrome.storage.session`**: Session metadata WITHOUT `dataUrl`. The `persist()` method strips `dataUrl` before writing. On service worker restart, `restore()` recovers the session but screenshots lose their image data (acceptable — user can recapture).

**Screenshot cap:** Maximum 10 screenshots per session. When the 11th would be added, the oldest is evicted (FIFO). This prevents unbounded memory growth in the service worker.

---

## Capture Flow

### When to capture

1. **After annotation completion** — in `handleMouseUp`, after `ANNOTATION_ADDED` is sent.
2. **After element selection** — in `handleClick`, after `ELEMENT_SELECTED` is sent.

Both go through the same dedup check + compositing delay.

### Content script dedup state

```typescript
let lastScreenshotTime = 0
let lastScreenshotScroll = { x: 0, y: 0 }
```

```typescript
function requestScreenshotAfterComposit(data: ScreenshotRequestData): void {
  // Wait for compositor to flush the canvas
  requestAnimationFrame(() => {
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'SCREENSHOT_REQUEST', data })
      lastScreenshotTime = Date.now()
      lastScreenshotScroll = { x: window.scrollX, y: window.scrollY }
    }, 0)
  })
}

function buildScreenshotRequest(
  annotationIndex?: number,
  selectedElementSelector?: string
): void {
  const now = Date.now()
  const scrollChanged = window.scrollX !== lastScreenshotScroll.x ||
                        window.scrollY !== lastScreenshotScroll.y
  const withinWindow = (now - lastScreenshotTime) < 2000

  const replacesPrevious = withinWindow && !scrollChanged && lastScreenshotTime > 0

  requestScreenshotAfterComposit({
    timestampMs: now - captureStartedAt,
    viewport: { scrollX: window.scrollX, scrollY: window.scrollY },
    annotationIndex,
    selectedElementSelector,
    replacesPrevious,
  })
}
```

Reset `lastScreenshotTime` and `lastScreenshotScroll` on `startCapture()`.

### SCREENSHOT_REQUEST message

```typescript
| { type: 'SCREENSHOT_REQUEST'; data: {
    timestampMs: number
    viewport: { scrollX: number; scrollY: number }
    annotationIndex?: number
    selectedElementSelector?: string
    replacesPrevious: boolean
  }}
```

The old `selector` and `rect` fields are removed. `SCREENSHOT_CAPTURED` response type is also removed from the `Message` union (unused by any consumer).

### Service worker handler

```typescript
case 'SCREENSHOT_REQUEST': {
  const session = store.getSession()
  if (!session) return undefined

  const dataUrl = await chrome.tabs.captureVisibleTab()
  const { timestampMs, viewport, annotationIndex, selectedElementSelector, replacesPrevious } = message.data

  // Build description parts
  const annotationIndices: number[] = []
  const descParts: string[] = []

  if (annotationIndex != null) {
    annotationIndices.push(annotationIndex)
    const ann = session.annotations[annotationIndex]
    if (ann) {
      const target = ann.nearestElement || 'unknown element'
      descParts.push(`${ann.type.charAt(0).toUpperCase() + ann.type.slice(1)} around ${target}`)
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

  const screenshot: AnnotatedScreenshot = {
    dataUrl,
    timestampMs,
    viewport,
    annotationIndices,
    descriptionParts: descParts,
    voiceContext,
  }

  if (replacesPrevious) {
    store.updateLastScreenshot(screenshot)
  } else {
    store.addAnnotatedScreenshot(screenshot)
  }

  return { type: 'SESSION_UPDATED', session: store.getSession() }
}
```

### SessionStore methods

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
  // Merge annotation indices and description parts
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

`persist()` strips `dataUrl` from screenshots before writing to `chrome.storage.session`:

```typescript
private persist(): void {
  if (!this.session) return
  try {
    const sessionForStorage = {
      ...this.session,
      screenshots: this.session.screenshots.map(s => ({ ...s, dataUrl: '' })),
    }
    chrome.storage.session.set({ activeSession: sessionForStorage })
  } catch { /* Silently fail */ }
}
```

---

## Sidepanel UI

### LiveFeedback (during capture)

Each screenshot appears as a thumbnail as it's captured:
- Thumbnail: ~120px wide, aspect ratio preserved
- Description below: *"Circle around .hero-title"*
- Voice context if available: *"need to expand this box"*
- Timestamp badge: `[00:31]`

### OutputView (after capture)

Screenshots section with larger thumbnails (~240px):
- Each screenshot has a **"Copy Image"** button
- Copies PNG to clipboard via `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`
- Description + voice context as caption
- **"Copy All"** button copies each image sequentially

### ScreenshotThumbnail component (new)

```typescript
interface ScreenshotThumbnailProps {
  screenshot: AnnotatedScreenshot
  size: 'small' | 'large'          // 120px vs 240px
  onCopy?: () => void
}
```

Renders: `<img>` from dataUrl, description text (joined with ` | `), voice context (italic), timestamp badge, optional copy button. Shows placeholder when `dataUrl` is empty (lost on service worker restart).

### Text output

The formatter's `## Screenshots` section becomes richer:

```
## Screenshots
1. [00:31] Circle around [src='/videos/define-loop.mp4'] — "need to expand this box"
2. [00:36] Freehand around #services — "and increase this spacing"
```

Description + voice context inline. `dataUrl` not emitted in text.

---

## Breaking Changes Migration

Replacing `ElementScreenshot` with `AnnotatedScreenshot` affects these files:

| File | What breaks | Fix |
|------|-------------|-----|
| `src/shared/types.ts` | `ElementScreenshot` interface removed | Replace with `AnnotatedScreenshot` |
| `src/shared/messages.ts:20` | `SCREENSHOT_REQUEST` data has `selector` + `rect` | Replace with new schema |
| `src/shared/messages.ts:27` | `SCREENSHOT_CAPTURED` response type | Remove entirely |
| `src/background/message-handler.ts:161-181` | Handler destructures `selector`, `rect` | Rewrite handler |
| `src/background/session-store.ts:1,53` | Imports `ElementScreenshot`, `addScreenshot` method | Replace with `AnnotatedScreenshot`, new methods |
| `src/content/index.ts:78-86` | Sends old `SCREENSHOT_REQUEST` shape | Replace with new dedup + composit flow |
| `src/shared/formatter.ts:231` | Reads `s.selector`, `s.width`, `s.height` | Read `s.descriptionParts`, `s.voiceContext` |
| `tests/shared/types.test.ts:57-59` | Constructs `ElementScreenshot` | Update to `AnnotatedScreenshot` shape |
| `tests/shared/formatter.test.ts:199-211` | Tests `formatScreenshots` with old shape | Rewrite with new shape |

---

## Files

| File | Change |
|------|--------|
| `src/shared/types.ts` | Replace `ElementScreenshot` with `AnnotatedScreenshot`, update `CaptureSession` |
| `src/shared/messages.ts` | Update `SCREENSHOT_REQUEST` data shape, remove `SCREENSHOT_CAPTURED` |
| `src/content/index.ts` | Add `SCREENSHOT_REQUEST` to `handleMouseUp`, dedup logic, compositing delay, dedup state |
| `src/background/message-handler.ts` | Build `AnnotatedScreenshot` with description + voice context, handle `replacesPrevious` |
| `src/background/session-store.ts` | `addAnnotatedScreenshot()`, `updateLastScreenshot()`, strip `dataUrl` in `persist()` |
| `src/shared/formatter.ts` | Enriched screenshot lines with description + voice context |
| `src/sidepanel/components/LiveFeedback.tsx` | Thumbnail display during capture |
| `src/sidepanel/components/OutputView.tsx` | Thumbnails + copy buttons after capture |
| `src/sidepanel/components/ScreenshotThumbnail.tsx` | New component |

## Testing

| Area | Tests |
|------|-------|
| **Dedup logic** | Time window (< 2s grouped, > 2s separate), scroll change forces new capture, rapid-fire 5 annotations → 1 screenshot, single annotation always captures, replacesPrevious flag set correctly |
| **Compositing delay** | rAF + setTimeout called before SCREENSHOT_REQUEST |
| **Description generation** | Circle → "Circle around X", multiple annotations → array merged, element selection → "Selected X", descriptionParts deduped via Set |
| **Voice context** | Overlapping segments found and joined, no overlap → undefined, ±2s window |
| **Screenshot grouping** | `updateLastScreenshot` merges indices + descriptions, dataUrl replaced |
| **Storage** | `persist()` strips dataUrl, `restore()` returns screenshots with empty dataUrl, cap at 10 with FIFO |
| **Formatter** | Enriched output with description + voice context |
| **Clipboard copy** | PNG blob created from dataUrl, ClipboardItem constructed correctly |

## Future: Session Replay (separate issue)

File a GitHub issue: **"Add tab video recording for session replay"**
- `tabCapture` permission + offscreen document + MediaRecorder
- Records full session as WebM
- Frame extraction at annotation timestamps
- Session replay viewer (playback with annotation overlay)
- References this feature's `AnnotatedScreenshot` model
- Maps to NLnet milestones M6 (integrations) and M8 (output formats)
