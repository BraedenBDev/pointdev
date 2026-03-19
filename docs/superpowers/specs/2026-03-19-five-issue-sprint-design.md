# Five-Issue Sprint Design — March 19, 2026

> Close #15, #26, #25, #8, #11 in a single day sprint. Last commit day before NLnet submission.

## Issues

| # | Title | Effort |
|---|-------|--------|
| #15 | Eliminate mic-permission tab requirement | ~90 min |
| #26 | CSS custom property discovery | ~30 min |
| #25 | Element ancestry cycling (Alt+scroll) | ~60 min |
| #8 | Freehand + rectangle annotation tools | ~90 min |
| #11 | Console errors + failed network requests | ~120 min |

---

## #15: Sidepanel-Native Speech Recognition

### Problem

Voice transcription runs in a dedicated `mic-permission.html` tab that must stay open for the entire capture session. Users close it accidentally, it clutters the tab bar, and it's confusing UX.

### Solution

Move `SpeechRecognition` from `mic-permission.js` into `useSpeechRecognition.ts`. The sidepanel hook becomes the speech host. The mic-permission tab becomes a one-time permission gate that auto-closes.

### Architecture

```
Mount → try navigator.permissions.query("microphone")
  granted → SpeechRecognition ready in sidepanel, no tab needed
  prompt  → try getUserMedia in sidepanel first (may show permission prompt)
    success → permission acquired, SpeechRecognition ready
    fail    → fallback: open mic-permission.html → user grants → tab sends MIC_PERMISSION_GRANTED → tab auto-closes
  denied  → show error, offer retry via mic-permission tab

Start capture → new SpeechRecognition() in sidepanel context
Stop capture  → recognition.stop(), nullify
```

**Risk: SpeechRecognition availability in sidepanel.** The sidepanel is a chrome-extension:// page. `webkitSpeechRecognition` should be available (it's a standard Web API, not gated by context type), but the permission prompt may not render. The architecture handles this:

1. Try `getUserMedia({audio:true})` in sidepanel — if Chrome shows the prompt and user grants, we're done.
2. If it throws `NotAllowedError` without showing a prompt (sidepanel limitation), fall back to the mic-permission tab for permission only.
3. Once permission is granted at the extension origin level (by any method), `SpeechRecognition` in the sidepanel will work — the permission is per-origin, not per-context.

**Validation step:** The implementer must test `new webkitSpeechRecognition(); recognition.start()` in a Chrome sidepanel before committing. If speech itself doesn't work in the sidepanel context (not just permission, but the API), fall back to the alternative design: keep speech in the mic tab but auto-close after capture ends.

### Files

| File | Change |
|------|--------|
| `src/sidepanel/hooks/useSpeechRecognition.ts` | Rewrite: own SpeechRecognition instance, try getUserMedia for permission, run speech locally |
| `public/mic-permission.js` | Simplify: permission acquisition only, auto-close tab after grant via `window.close()` |
| `public/mic-permission.html` | Update copy (no "keep this tab open") |
| `public/offscreen.js` | Delete (dead code) |
| `public/offscreen.html` | Delete (dead code) |
| `src/manifest.json` | Remove `offscreen` permission |
| `tests/sidepanel/hooks/useSpeechRecognition.test.ts` | Full rewrite: test new sidepanel-native speech flow, permission state machine, fallback paths |

### Fallback

If the sidepanel can't trigger the permission prompt (older Chrome), the mic-permission tab still opens for permission only, then auto-closes. If SpeechRecognition itself doesn't work in the sidepanel (unlikely but possible), revert to keeping speech in the tab but auto-closing after capture completes.

### Messages removed from broadcast pattern

`SPEECH_START`, `SPEECH_STOP`, `SPEECH_STARTED`, `SPEECH_RESULT`, `SPEECH_ERROR` all become internal to the hook. Only `MIC_PERMISSION_GRANTED` remains as a cross-context message (from the permission tab when the fallback path is used). `TRANSCRIPT_UPDATE` to the service worker is unchanged.

---

## #26: CSS Custom Property Discovery

### Problem

AI agents working with design systems need CSS variable values, not just computed properties. Currently PointDev only captures computed styles.

### Solution

Scan `document.styleSheets` for rules matching the selected element, extract `--custom-property` declarations.

### Implementation

New function in `element-selector.ts`:

```typescript
export function discoverCssVariables(element: Element, doc: Document): Record<string, string> {
  const vars: Record<string, string> = {}
  let count = 0
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (!(rule instanceof CSSStyleRule)) continue
        try {
          if (!element.matches(rule.selectorText)) continue
        } catch { continue } // SyntaxError on pseudo-element selectors like ::before
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i]
          if (prop.startsWith('--') && count < 50) {
            vars[prop] = rule.style.getPropertyValue(prop)
            count++
          }
        }
      }
    } catch { /* cross-origin sheets throw SecurityError — skip */ }
  }
  return vars
}
```

**Limitation:** CSS variables from inherited rules (e.g., `:root { --primary: ... }`) are only captured if the element directly matches the rule selector. This is a deliberate scope limitation — scanning all ancestor rules would be expensive and noisy.

### Files

| File | Change |
|------|--------|
| `src/content/element-selector.ts` | Add `discoverCssVariables()` function |
| `src/shared/types.ts` | Add `cssVariables?: Record<string, string>` to `SelectedElementData` |
| `src/content/index.ts` | Call `discoverCssVariables` after `extractElementData`, attach to data |
| `src/shared/formatter.ts` | Add CSS variables line to Target Element and annotation context sections |

### Formatter output

```
- CSS Variables: --primary: #2563eb, --spacing-md: 16px, --border-radius: 8px
```

### Attribution

Pattern from pi-annotate by Nico Bailon (MIT).

---

## #25: Element Ancestry Cycling (Alt+Scroll)

### Problem

Clicking the exact element you mean is frustrating on nested layouts. Users often want the parent container, not the innermost text node.

### Solution

Alt+scroll in select mode walks up/down the DOM tree from the hovered element.

### State

```typescript
let hoveredElement: Element | null = null
let ancestryChain: Element[] = []  // [innermost, parent, grandparent, ...]
let ancestryIndex = 0              // 0 = original, +1 = parent, etc.
let highlightEl: HTMLElement | null = null  // visual feedback overlay
```

### Behavior

1. On `mousemove` in select mode: update `hoveredElement`, rebuild ancestry chain, reset index to 0
2. On `wheel` with `altKey` in select mode: `preventDefault()`, adjust index (deltaY < 0 = parent, deltaY > 0 = child)
3. Visual feedback: outline highlight on `ancestryChain[ancestryIndex]` via a positioned div with `outline: 2px dashed #FF3333`
4. On `click`: if `ancestryChain.length > 0 && hoveredElement`, use `ancestryChain[ancestryIndex]`; otherwise fall through to `findNearestElement()` (preserves default behavior when no alt-scrolling occurred)
5. Reset on: mouse leaving element area, mode change to circle/arrow

**Wheel listener must use `{ passive: false }`** to allow `preventDefault()`. This is a separate listener from the canvas scroll handler (which uses `{ passive: true }`). The wheel listener attaches to `document`, not the canvas, since `pointerEvents: 'none'` is set in select mode.

### Edge cases

- Stop at `document.body` going up
- Stop at index 0 (innermost element) going down
- Skip elements with `data-pointdev` attribute
- Chain capped at 10 ancestors (deeper nesting is rarely useful)
- Ancestry chain and highlight cleaned up on `stopCapture()`

### Files

| File | Change |
|------|--------|
| `src/content/index.ts` | Add wheel handler, ancestry state, highlight element management |
| `src/content/element-selector.ts` | Add `getAncestryChain(element: Element, maxDepth?: number): Element[]` |

### Attribution

Pattern from pi-annotate by Nico Bailon (MIT).

---

## #8: Freehand + Rectangle Annotation Tools

### Problem

Circle and arrow are the only drawing tools. Users need freehand (circling irregular areas) and rectangle (highlighting UI regions).

### Solution

Extend the existing canvas pipeline with two new annotation types.

### New types

```typescript
// In types.ts
export interface FreehandCoords {
  points: Array<{ x: number; y: number }>
}

export interface RectangleCoords {
  x: number
  y: number
  width: number
  height: number
}

// AnnotationData.type becomes: 'circle' | 'arrow' | 'freehand' | 'rectangle'
// AnnotationData.coordinates becomes: CircleCoords | ArrowCoords | FreehandCoords | RectangleCoords
```

### CaptureMode extension

```typescript
// In messages.ts
export type CaptureMode = 'select' | 'circle' | 'arrow' | 'freehand' | 'rectangle'
```

### Canvas overlay additions

```typescript
// New stored types
interface StoredFreehand { type: 'freehand'; points: Array<{ x: number; y: number }> }
interface StoredRectangle { type: 'rectangle'; x: number; y: number; w: number; h: number }

// Extend preview type to support freehand's point array
private currentPreview:
  | { type: 'circle' | 'arrow' | 'rectangle'; start: Point; current: Point }
  | { type: 'freehand'; points: Point[] }
  | null = null

// New public methods
drawFreehandPreview(points: Point[]): void
drawRectanglePreview(start: Point, current: Point): void
completeFreehandAnnotation(points: Point[], captureStartedAt: number, now: number): AnnotationData | null
// Note: completeAnnotation(start, end, ...) handles rectangle (two corners define it)
// Freehand needs a separate method because it takes a points array, not start/end

// New private renderers
private drawPolyline(points: Array<{ x: number; y: number }>): void
private drawRect(x: number, y: number, w: number, h: number): void
```

### Drawing state in content script index.ts

```typescript
// Module-level state for freehand point collection
let freehandPoints: Array<{ clientX: number; clientY: number }> = []
```

On mousedown in freehand mode: `freehandPoints = [{ clientX, clientY }]`
On mousemove in freehand mode: `freehandPoints.push({ clientX, clientY })`, call `drawFreehandPreview`
On mouseup in freehand mode: call `completeFreehandAnnotation(freehandPoints, ...)`, reset `freehandPoints = []`

### Drawing behavior

- **Freehand:** Collect viewport points on mousemove into `freehandPoints` array in `index.ts`. On mouseup, pass to `completeFreehandAnnotation` which converts all to page-relative. Minimum 3 points to complete. Rendered as connected line segments via `ctx.lineTo`.
- **Rectangle:** mousedown = first corner, mousemove = preview rect, mouseup = finalize via existing `completeAnnotation(start, end)`. Minimum 10px on either dimension. Stored as top-left corner + width + height (computed from min/max of the two corners).

### Minimum size thresholds

- Freehand: 3+ points required
- Rectangle: 10px minimum on width or height

### Focal point for nearestElement

- Freehand: centroid of all points
- Rectangle: center of the rectangle

### Files

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `FreehandCoords`, `RectangleCoords`, extend `AnnotationData` |
| `src/shared/messages.ts` | Extend `CaptureMode` union |
| `src/content/canvas-overlay.ts` | Add stored types, preview methods, drawing methods, extend `completeAnnotation` and `redraw` |
| `src/content/index.ts` | Handle freehand/rectangle in mouse handlers, collect freehand points array |
| `src/sidepanel/components/CaptureControls.tsx` | Add freehand (&#9998;) and rectangle (&#9633;) mode buttons |
| `src/shared/formatter.ts` | Format freehand/rectangle annotations |

### Formatter output

```
3. [00:15] Freehand around button.submit-btn (12 points, ~200x150px area)
4. [00:20] Rectangle over div.card-container at (100, 200), 300x200px
```

---

## #11: Console Errors + Failed Network Requests

### Problem

When a developer points at a broken UI element, having the corresponding `TypeError` or `404` in the capture output makes the prompt dramatically more actionable.

### Solution

Inject monkey-patching code into the **page's main world** via `chrome.scripting.executeScript({ world: 'MAIN' })`. MV3 content scripts run in an isolated world with their own JS globals — patching `console.error` or `fetch` in the content script world would NOT intercept the page's calls. The main-world injection bridges back to the content script via `CustomEvent` on the DOM.

No new permissions required — `scripting` permission already covers `world: 'MAIN'` execution.

### Two-world architecture

```
Page's Main World                    Content Script (Isolated World)
─────────────────                    ──────────────────────────────
Injected via executeScript:          Listener on document:
  - Patches console.error/warn        - document.addEventListener(
  - Patches fetch, XHR                    'pointdev-console-batch', ...)
  - Listens for window errors          - Unpacks event.detail
  - Batches entries every 500ms        - Sends CONSOLE_BATCH to service worker
  - Dispatches CustomEvent to DOM
    ('pointdev-console-batch')
```

### New types

```typescript
export interface ConsoleEntry {
  level: 'error' | 'warn'
  message: string
  stack?: string
  timestampMs: number
}

export interface FailedRequest {
  method: string
  url: string
  status: number  // 0 for network error
  statusText: string
  timestampMs: number
}
```

### Session extension

```typescript
// Add to CaptureSession
consoleErrors: ConsoleEntry[]
failedRequests: FailedRequest[]
```

Also update `createEmptySession()` in `types.ts` to initialize `consoleErrors: []` and `failedRequests: []`.

### New module: `src/content/console-network-capture.ts`

The content-script-side coordinator:

```typescript
export class ConsoleNetworkCapture {
  private captureStartedAt: number
  private onBatch: (entries: ConsoleEntry[], requests: FailedRequest[]) => void
  private listener: ((e: Event) => void) | null = null

  constructor(captureStartedAt: number, onBatch: callback)
  start(tabId: number): void  // Inject main-world script, attach DOM event listener
  stop(): void                // Remove DOM event listener, inject cleanup into main world
}
```

### Main-world injection script

Injected as a string via `chrome.scripting.executeScript({ world: 'MAIN', func: ... })` from the content script (which asks the service worker to execute it, since content scripts can't call `chrome.scripting`). Alternatively, the service worker injects it during `startCapture`.

The injected code:
- Saves originals: `console.error`, `console.warn`, `fetch`, `XMLHttpRequest.prototype.send`
- Wraps each to capture relevant data
- Listens for `window.addEventListener('error', ...)` (uncaught exceptions)
- Listens for `window.addEventListener('unhandledrejection', ...)` (unhandled promise rejections)
- Batches entries every 500ms
- Dispatches `new CustomEvent('pointdev-console-batch', { detail: { entries, requests } })` on `document`
- Restores all originals when a `pointdev-console-stop` event is received

### Patching strategy (runs in main world)

- `console.error/warn`: Save original, replace with wrapper that captures message + stack trace, calls original
- `fetch`: Wrap with `.then()` that checks `!response.ok`, `.catch()` for network errors
- `XMLHttpRequest.send`: Wrap to add `loadend` listener that checks `status >= 400` or `status === 0`
- `window 'error' event`: Capture uncaught exceptions with stack traces
- `window 'unhandledrejection' event`: Capture unhandled promise rejections
- Batch every 500ms via `setInterval` (same pattern as cursor tracker)
- On `pointdev-console-stop` event: restore all originals, clear interval, dispatch final batch

### Security

- Request/response bodies are NOT captured (may contain auth tokens, PII)
- Only method, URL, status code, and status text
- URL is truncated at 200 characters
- The `CustomEvent.detail` contains only serializable data (strings, numbers) — no objects from the page's world leak into the content script

### Files

| File | Change |
|------|--------|
| `src/content/console-network-capture.ts` | New file: ConsoleNetworkCapture class (content-script side coordinator) |
| `src/shared/types.ts` | Add `ConsoleEntry`, `FailedRequest`, extend `CaptureSession`, update `createEmptySession()` |
| `src/shared/messages.ts` | Add `CONSOLE_BATCH` message type |
| `src/content/index.ts` | Start/stop ConsoleNetworkCapture alongside CursorTracker |
| `src/background/message-handler.ts` | Handle `CONSOLE_BATCH`, inject main-world script via `chrome.scripting.executeScript({ world: 'MAIN' })` during capture start |
| `src/background/session-store.ts` | Add `addConsoleBatch(entries: ConsoleEntry[], requests: FailedRequest[]): void` method |
| `src/shared/formatter.ts` | Add "## Console & Network" section |

### Formatter output

```
## Console & Network
Errors:
- [00:05] TypeError: Cannot read property 'map' of undefined
    at UserList.render (app.js:142)
- [00:12] Warning: Each child in a list should have a unique "key" prop

Failed requests:
- [00:03] GET /api/users → 404 Not Found
- [00:08] POST /api/submit → 0 (network error)
```

---

## Testing

| Issue | Tests |
|-------|-------|
| #15 | Full rewrite of `useSpeechRecognition.test.ts`: mock SpeechRecognition class, test permission state machine (checking → granted, checking → needs-setup → granted via tab), test start/stop/error flows, test fallback when getUserMedia throws |
| #26 | Mock `document.styleSheets` with CSS variables, test extraction and cap at 50, test `element.matches` SyntaxError handling, test cross-origin sheet skip |
| #25 | Test `getAncestryChain` returns correct chain, stops at body, caps at 10, skips `data-pointdev` elements |
| #8 | Test `completeFreehandAnnotation` with points array, test `completeAnnotation` for rectangle, minimum size thresholds (3 points / 10px), formatter output for both types, centroid/center focal point calculation |
| #11 | Test ConsoleNetworkCapture DOM event listener, test formatter output, test `createEmptySession` includes new arrays, test `addConsoleBatch` method signature |

## Integration: Shared File Conflicts

Four issues touch `src/content/index.ts`. When implementing in parallel via subagents, merge conflicts are guaranteed. Mitigation:
- Each subagent works in an isolated worktree
- Merges happen sequentially in commit order
- `index.ts` conflicts are resolved by the merge coordinator (main agent)

## Dependency Order

Issues are independent — no blocking dependencies between them. All 5 can be implemented in parallel via subagents, then merged sequentially. Recommended commit order for clean git history:

1. #15 (architecture change — mic, isolated to sidepanel + public files)
2. #26 (small addition — CSS vars)
3. #25 (content script — ancestry cycling)
4. #8 (canvas + types + UI — annotation tools)
5. #11 (new module — console/network, most complex due to world bridging)
