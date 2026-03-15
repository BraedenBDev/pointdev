# PointDev — Proof of Concept Design Specification

## Overview

PointDev is a Chrome extension that captures structured browser context through simultaneous voice narration, canvas annotation, element selection, and cursor tracking, then compiles it into a structured prompt ready for AI coding agents.

The browser is the most universal interface on the internet, but there is no open way to extract structured context from what a user sees and communicate it to another system. When someone spots a problem in a browser, they take a screenshot, switch to another tool, and type a description that loses most of the technical context they were just looking at. The DOM path, component name, console errors, viewport state, and the user's spatial intent are lost in translation.

PointDev captures both technical context (CSS selectors, framework component names, DOM subtree, computed styles, page URL, viewport) and human context (voice transcript of what the user wants, visual annotations showing where the issue is, cursor behavior showing what they were looking at). A template formatter merges these into a single structured output that any AI coding agent can act on.

This proof of concept demonstrates the core capture-compile pipeline end-to-end.

---

## Architecture

### Extension Contexts (Manifest V3)

```
┌─────────────────────────────────────────────────┐
│ Chrome Extension (MV3)                          │
│                                                 │
│  ┌──────────────┐    ┌───────────────────────┐  │
│  │ Service       │◄──►│ Sidepanel             │  │
│  │ Worker        │    │ (React, controls +    │  │
│  │ (coordinator) │    │  compiled output)     │  │
│  └──────┬───────┘    └───────────────────────┘  │
│         │                                       │
│         ▼                                       │
│  ┌──────────────────────────────────────────┐   │
│  │ Content Script (injected into page)      │   │
│  │  ├── Element Selector (click → DOM info) │   │
│  │  ├── Canvas Overlay (annotations)        │   │
│  │  ├── Cursor Tracker (dwell detection)    │   │
│  │  └── React Fiber Inspector (optional)    │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**Service Worker** — Coordinates message passing between sidepanel and content script. Holds the `CaptureSession` state object. Routes events (element selected, annotation added, transcript updated) between contexts.

**Sidepanel** — Built with React. Two views: capture controls (record/annotate/select element) and compiled output display with copy-to-clipboard. Shows live feedback during capture (recording timer, live transcript, annotation count, selected element).

**Content Script** — Injected into the active tab on capture start. Four responsibilities:
1. Element selection: intercepts clicks, extracts DOM info, prevents navigation
2. Canvas overlay: transparent canvas for drawing annotations
3. Cursor tracking: throttled mousemove sampling with dwell detection
4. React fiber inspection: opportunistic component name resolution

### Permissions

Minimal permission set:
- `activeTab` — access to the current tab only, on user action
- `scripting` — inject content script on capture start
- `sidePanel` — Chrome sidepanel API
- `storage` — persist user preferences (annotation color, tool defaults)

No `debugger`, `tabs`, `<all_urls>`, or host permissions required.

---

## Data Model

### CaptureSession

```typescript
interface CaptureSession {
  id: string
  startedAt: number
  url: string
  title: string
  viewport: { width: number; height: number }

  selectedElement: {
    selector: string
    computedStyles: Record<string, string>
    domSubtree: string
    boundingRect: DOMRect
    reactComponent?: {
      name: string
      filePath?: string
    }
  } | null

  voiceRecording: {
    transcript: string
    durationMs: number
    segments: Array<{
      text: string
      startMs: number
      endMs: number
    }>
  } | null

  annotations: Array<{
    type: 'circle' | 'arrow'
    coordinates: CircleCoords | ArrowCoords
    timestampMs: number
    nearestElement?: string
  }>

  cursorTrace: Array<{
    x: number
    y: number
    timestampMs: number
    nearestElement?: string
    dwellMs?: number
  }>

  screenshot: string | null
}

interface CircleCoords {
  centerX: number
  centerY: number
  radiusX: number
  radiusY: number
}

interface ArrowCoords {
  startX: number
  startY: number
  endX: number
  endY: number
}
```

All coordinates are page-relative (adjusted by `window.scrollX/Y`), so annotations stay anchored to elements regardless of scroll position during capture.

---

## Capture Flow

### Interaction Sequence

1. User opens the sidepanel and clicks **"Start Capture"**
2. Content script is injected into the active tab
3. Voice recording begins (Web Speech API, `continuous: true`, `interimResults: true`)
4. Content script enters capture mode:
   - Clicks select elements instead of navigating (via `preventDefault` + `stopPropagation` on click)
   - Canvas overlay is injected (transparent, full-page, `pointer-events: none` by default)
   - Cursor tracking begins (throttled `mousemove` at ~100ms intervals)
5. User toggles between three modes via sidepanel controls:
   - **Select** — clicks capture element info
   - **Circle** — click-and-drag on canvas draws ellipse
   - **Arrow** — click-and-drag on canvas draws arrow
6. All actions write to the shared `CaptureSession` with timestamps relative to `startedAt`
7. Sidepanel shows live feedback: recording timer, transcript, annotation list, selected element
8. User clicks **"Stop Capture"**
9. Screenshot of the viewport is taken via `chrome.tabs.captureVisibleTab()`
10. Canvas overlay is removed from the page
11. Session is passed to the template formatter
12. Sidepanel switches to output view showing the compiled prompt

### Mode Switching

When annotation mode is active (circle or arrow), the canvas overlay receives `pointer-events: all` and page interaction is suppressed. When select mode is active, the canvas overlay returns to `pointer-events: none` and clicks pass through to the page for element selection.

The mode toggle is three small icons in the sidepanel. Default mode on capture start is **Select**.

---

## Canvas Annotation Overlay

A transparent `<canvas>` element injected by the content script, using `position: fixed` covering the viewport (`window.innerWidth x window.innerHeight`). Fixed positioning means the canvas stays in place during scroll without resizing. Coordinates are converted to page-relative on each draw action by adding `window.scrollX/Y` at the moment of mouse release.

The canvas `z-index` is set to `2147483647` (max) to ensure it sits above all page content. The canvas element is tagged with a `data-pointdev` attribute so it can be reliably filtered from `elementsFromPoint` results.

### Drawing Mechanics

**Circle:** Click-and-drag from center outward. Renders as a red stroke ellipse (2px, `#FF3333`). On mouse release, records center point, radii, timestamp, and nearest element.

**Arrow:** Click-and-drag from tail to head. Renders as a red line (2px, `#FF3333`) with a triangular arrowhead (12px). On mouse release, records start point, end point, timestamp, and nearest element.

### Coordinate System

All coordinates stored page-relative using `window.scrollX/Y` offset at time of drawing. Annotations stay anchored to their position on the page, not the viewport.

### Element Proximity Mapping

On mouse release, the nearest meaningful element is resolved using the current scroll position at that moment:
1. Get the center point of the annotation (page-relative)
2. Convert to viewport-relative: `viewportX = centerX - window.scrollX`, `viewportY = centerY - window.scrollY`
3. Call `document.elementsFromPoint(viewportX, viewportY)`
4. Filter out elements with `data-pointdev` attribute, `<body>`, `<html>`, and elements with no semantic meaning
5. Take the first (topmost) remaining element
6. Generate its CSS selector and store as `nearestElement`

### CSS Selector Generation

Selectors are generated using a simple strategy: if the element has an `id`, use `#id`. Otherwise, build the shortest unique path using tag names and class names, with `:nth-child()` disambiguation when needed. For the PoC, use the `css-selector-generator` npm package rather than a hand-rolled implementation.

### Cleanup

When capture stops, the canvas element is removed from the DOM. All annotation data lives in the `CaptureSession` object.

---

## Voice Recording & Transcription

### Web Speech API

```typescript
const recognition = new SpeechRecognition()
recognition.continuous = true
recognition.interimResults = true
recognition.lang = navigator.language
```

- Starts when capture begins, stops when capture ends
- `onresult` events fire with recognized phrases; each final result is timestamped relative to `CaptureSession.startedAt` and pushed to `voiceRecording.segments`
- Interim results are shown in the sidepanel for live feedback but not stored in segments — only final results are persisted
- The full concatenated transcript is stored in `voiceRecording.transcript`

### Microphone Permission Handling

Web Speech API runs in the sidepanel context and triggers Chrome's standard microphone permission prompt on first use. This is a **high-risk technical assumption** — sidepanel pages may not reliably trigger the permission prompt in all Chrome versions.

**Mitigation:** Build a minimal spike early (day 1-2) to validate that `SpeechRecognition` works in a Chrome sidepanel. If it does not:
- **Fallback A:** Run Web Speech API in an offscreen document (`chrome.offscreen.createDocument`) and relay transcript events to the sidepanel via message passing. Offscreen documents are specifically designed for audio-related tasks in MV3.
- **Fallback B:** Run Web Speech API in the content script context (has access to the page's audio permissions) and relay transcript events to the service worker.

**If permission is denied:** The sidepanel shows a message: "Microphone access is needed for voice capture. Click to grant permission." Capture can still proceed without voice — all other layers (element selection, annotations, cursor tracking) work independently.

### Limitations

- Requires internet connection (Chrome sends audio to Google for recognition)
- Recognition quality varies by accent, background noise, and microphone
- No audio recording is stored — only the text transcript

---

## Cursor Tracking & Dwell Detection

### Tracking

During capture, `mousemove` events are sampled at ~100ms intervals (throttled via `requestAnimationFrame` or timestamp check). Each sample records:
- Page-relative x/y position
- Timestamp relative to recording start
- Nearest element (via `document.elementFromPoint`)

### Dwell Detection

A "dwell" is detected when the cursor stays within a ~30px radius for more than 500ms. Dwells are strong signals of user intent — the user is looking at and pointing to something specific.

On capture end, the cursor trace is post-processed:
1. Consecutive samples within 30px are grouped
2. Groups lasting >500ms are marked as dwells with `dwellMs` set
3. Dwells that overlap with annotation positions are suppressed (redundant with explicit annotation)

### Output Treatment

Cursor behavior is secondary to explicit annotations. In the compiled output:
- Dwells appear in a "Cursor Behavior" section, below annotations
- Raw cursor movement is stored in the session but not compiled into output (available for future use)
- If a dwell coincides with a voice segment, the transcript excerpt is included for correlation

---

## React Component Detection

### Approach

Opportunistic, read-only inspection of React fiber internals. Not required for the extension to function — it enhances output when available.

### Resolution Steps

1. On element selection, walk up the DOM from the clicked element
2. Check each DOM node for `__reactFiber$*` or `__reactInternalInstance$*` keys (React 16+ attaches these with a random suffix)
3. If a fiber is found, traverse the fiber tree upward to find the nearest user-defined component (skip built-in elements like `div`, `span`, `p`)
4. Extract `fiber.type.name` or `fiber.type.displayName` for the component name
5. Extract `fiber._debugSource` for file path and line number (development builds only)

### Fallback Chain

1. React fiber found → component name + optional file path
2. React fiber not found → check for `__VUE__` on elements (log detection for future support, do not resolve)
3. Nothing found → CSS selector + DOM subtree only

### Safety

This is read-only property access on DOM nodes. No DevTools protocol, no special permissions, no side effects. Works on any React page where fiber internals are exposed (all dev builds, most production builds unless component names are explicitly minified).

---

## Template Formatter

A single function that takes a `CaptureSession` and produces structured plain text. Not a pluggable compiler — a proof-of-concept formatter.

### Output Format

```
## Context
- URL: {url}
- Page title: {title}
- Viewport: {viewport.width} x {viewport.height}px
- Captured at: {ISO timestamp}

## Target Element
- Selector: {selector}
- React Component: <{componentName}> ({filePath})
- Computed: {key: value pairs for font-size, color, background, etc.}
- DOM: {truncated outerHTML}

## User Intent (voice transcript)
[{startMs formatted}] "{segment text}"
[{startMs formatted}] "{segment text}"

## Annotations
1. [{timestampMs formatted}] Circle around {nearestElement} at ({centerX}, {centerY}), radius {radius}px
2. [{timestampMs formatted}] Arrow from ({startX}, {startY}) to ({endX}, {endY}), pointing at {nearestElement}

## Cursor Behavior
- [{startMs}–{endMs}] Dwelled {dwellMs}s over {nearestElement} (during: "{correlated transcript}")

## Screenshot
[base64 data URL]
```

### Rules

- **Sections only appear if data exists.** No voice? No "User Intent" section. No React component? That line is omitted from "Target Element." No dwells? No "Cursor Behavior" section.
- **Timestamps are formatted as MM:SS** relative to recording start (e.g., `[00:23]`).
- **Computed styles are filtered** to a useful subset of longhand properties: `font-size`, `font-weight`, `font-family`, `color`, `background-color`, `width`, `height`, `padding-top`, `padding-right`, `padding-bottom`, `padding-left`, `margin-top`, `margin-right`, `margin-bottom`, `margin-left`, `display`, `position`. Shorthand properties (`padding`, `margin`) are not returned by `getComputedStyle()`, so we capture the individual sides and reconstruct shorthand in the output when all four values are equal (e.g., `padding: 8px` instead of four separate lines).
- **DOM subtree is truncated** to the element's `outerHTML`, capped at ~500 characters. Truncation strategy: include the full opening tag with all attributes. Include direct text content. For child elements, collapse them as `<div>...</div>` (opening tag, ellipsis, closing tag, no attributes). If the result still exceeds 500 characters, cut at 500 and append `<!-- truncated -->`.
- **Screenshot is base64 data URL.** Included at the end. Large, but functional for clipboard paste into AI tools.

---

## Sidepanel UI

Built with React. Two states, minimal styling.

### Capture Mode

```
┌─────────────────────────────┐
│ PointDev                    │
│                             │
│  ● Recording  00:23         │
│                             │
│  Mode: [Select] [○] [→]    │
│                             │
│  [🔴 Stop Capture]          │
│                             │
│  Selected: div.hero > h1    │
│  Component: <HeroSection>   │
│                             │
│  Annotations: 2             │
│  ├ Circle on div.hero > h1  │
│  └ Arrow to nav > a.pricing │
│                             │
│  Transcript (live):         │
│  "...font is far too small, │
│   lets increase 25%"        │
└─────────────────────────────┘
```

- Recording timer counts up from 00:00
- Mode toggle: three icons for Select, Circle, Arrow. Active mode is highlighted.
- Selected element updates on each click (shows selector, component name if detected)
- Annotation list grows as user draws
- Live transcript shows interim results from Web Speech API, updating in real-time

### Output Mode (after capture stops)

```
┌─────────────────────────────┐
│ PointDev          [← Back]  │
│                             │
│  ┌───────────────────────┐  │
│  │ Compiled output       │  │
│  │ (scrollable, styled   │  │
│  │  plain text with      │  │
│  │  section headers)     │  │
│  │                       │  │
│  │ ## Context            │  │
│  │ URL: example.com/...  │  │
│  │                       │  │
│  │ ## Target Element     │  │
│  │ Selector: div.hero... │  │
│  │ ...                   │  │
│  └───────────────────────┘  │
│                             │
│  [📋 Copy to Clipboard]     │
│                             │
│  ✓ Copied!                  │
└─────────────────────────────┘
```

- Compiled output displayed as formatted text with visual section headers
- Copy button copies the plain text version (the structured prompt)
- "Back" returns to capture mode for a new session
- Copy feedback ("Copied!") shown briefly after click

### Error and Edge States

- **Content script injection failed** (restricted page): sidepanel shows "Cannot capture on this page" with explanation
- **Microphone permission denied**: sidepanel shows "Microphone access needed for voice capture" with a re-prompt link. Capture can proceed without voice.
- **Empty capture** (user stops without selecting, annotating, or speaking): sidepanel shows "No context captured. Try selecting an element or recording your voice." Returns to capture mode.
- **Loading**: brief "Preparing capture..." while content script is injected (typically <200ms)

### Styling

- System font stack, no custom fonts
- Monospace for selectors, code, and DOM snippets
- Supports `prefers-color-scheme` (light/dark)
- Tight spacing, no decorative elements
- No branding beyond the name "PointDev" in the header

---

## Message Passing

Communication between extension contexts uses `chrome.runtime.sendMessage` and `chrome.runtime.onMessage`.

### Message Types

```typescript
// Extracted types for message payloads
type SelectedElement = NonNullable<CaptureSession['selectedElement']>
type Annotation = CaptureSession['annotations'][number]
type CursorSample = Omit<CaptureSession['cursorTrace'][number], 'dwellMs'>
type VoiceSegment = NonNullable<CaptureSession['voiceRecording']>['segments'][number]

type Message =
  // Sidepanel → Service Worker
  | { type: 'START_CAPTURE' }
  | { type: 'STOP_CAPTURE' }
  | { type: 'SET_MODE'; mode: 'select' | 'circle' | 'arrow' }
  | { type: 'TRANSCRIPT_UPDATE'; data: { transcript: string; segment: VoiceSegment } }

  // Service Worker → Content Script
  | { type: 'INJECT_CAPTURE' }
  | { type: 'REMOVE_CAPTURE' }
  | { type: 'MODE_CHANGED'; mode: 'select' | 'circle' | 'arrow' }
  | { type: 'PING' }

  // Content Script → Service Worker
  | { type: 'ELEMENT_SELECTED'; data: SelectedElement }
  | { type: 'ANNOTATION_ADDED'; data: Annotation }
  | { type: 'CURSOR_BATCH'; data: CursorSample[] }
  | { type: 'PONG' }

  // Service Worker → Sidepanel
  | { type: 'SESSION_UPDATED'; session: CaptureSession }
  | { type: 'CAPTURE_COMPLETE'; session: CaptureSession }
```

### Voice Recording Context

Web Speech API runs in the **sidepanel context**, not the content script. This avoids content script isolation issues and keeps the microphone permission scoped to the extension. The sidepanel sends `TRANSCRIPT_UPDATE` messages to the service worker as final transcript segments arrive. The `transcript` field in the message is the full concatenated transcript — the service worker treats it as the authoritative value and overwrites (not appends) on each update. The sidepanel is the source of truth for voice data.

### Cursor Trace Batching

Cursor samples at 100ms intervals would flood the message channel. Instead, the content script accumulates samples in a local buffer and sends them every 500ms as a single `CURSOR_BATCH` message.

### Content Script Injection Guard

Before injecting the content script, the service worker sends a `PING` message to the tab. If the content script is already present, it responds with `PONG` and injection is skipped. If no response within 500ms, the content script is injected fresh via `chrome.scripting.executeScript()`.

On restricted pages (`chrome://`, `chrome-extension://`, Chrome Web Store), `executeScript` will fail. The service worker catches this error and sends a message to the sidepanel: "Cannot capture on this page."

### Service Worker Lifecycle

MV3 service workers are ephemeral — Chrome can terminate them after ~30 seconds of inactivity. During active capture, the sidepanel maintains a long-lived port connection to the service worker via `chrome.runtime.connect()`. This port keeps the service worker alive for the duration of the capture session. As a secondary safeguard, the `CaptureSession` is incrementally written to `chrome.storage.session` (in-memory, survives worker restarts but not browser restarts) after each state change.

**Recovery protocol:** On service worker startup, check `chrome.storage.session` for an active `CaptureSession` (one without a `completedAt` timestamp). If found, restore it into memory and wait for sidepanel reconnection. The sidepanel detects port disconnection via the port's `onDisconnect` event and re-establishes via `chrome.runtime.connect()`, which wakes the service worker. The content script (still injected in the tab) continues operating independently — its messages queue until the service worker is back.

### Tab Lifecycle During Capture

The `CaptureSession` stores the `tabId` of the active tab at capture start. If the user switches tabs, capture continues (voice recording is in the sidepanel, unaffected) but element selection and annotation are only active when the captured tab is focused. On `STOP_CAPTURE`, `captureVisibleTab()` is called only if the original tab is still active — otherwise the screenshot is omitted with a note in the compiled output.

The canvas overlay is removed *before* the screenshot is taken, so annotations do not appear in the screenshot. The screenshot captures the page as the user sees it; annotations are recorded separately in the structured data.

---

## Known Limitations & Future Direction

**Transcription quality and privacy.** Web Speech API sends audio to Google's servers and recognition quality varies. A local transcription option (Whisper or browser-native on-device models) would improve both reliability and privacy.

**Annotation tools.** Circle and arrow cover most pointing use cases. Freehand drawing, rectangles, and text labels would round out the annotation toolkit for more nuanced communication.

**Framework coverage.** React component detection only. Vue and Svelte expose similar internals (`__VUE__`, Svelte compiler metadata) that could be resolved with framework-specific adapters following the same pattern.

**Output format.** Plain text via a template formatter. A pluggable compiler architecture with structured format adapters (JSON, Markdown, MCP-compatible) would make the output consumable by any downstream system programmatically and allow the capture format to become an open standard.

**Console and network context.** Browser console errors and failed network requests are high-value context for debugging. Capturing them requires the `chrome.debugger` API, which triggers a Chrome warning bar and needs explicit user opt-in — worth adding behind a permission gate.

**Direct tool integration.** Output currently goes via clipboard. A local relay server (WebSocket) could deliver structured context directly to AI coding tools (Claude Code, Aider, Continue) without manual paste.

**Multi-element selection.** The current design captures one selected element per session. Supporting multiple element selections (e.g., "these three buttons are inconsistent") would increase expressiveness.

**Session history.** No persistence between captures. Saving and replaying sessions would enable QA workflows and team collaboration.

---

## Tech Stack

- **Extension framework:** Chrome MV3, vanilla service worker
- **Sidepanel UI:** React 18 + TypeScript
- **Content script:** TypeScript, compiled separately from sidepanel
- **Canvas:** HTML5 Canvas API (2D context), no libraries
- **Voice:** Web Speech API (`SpeechRecognition`)
- **Build:** Vite with CRXJS plugin (or manual Vite multi-entry build for MV3)
- **Package manager:** bun
- **Testing:** Vitest for unit tests, manual testing for extension integration

---

## File Structure (projected)

```
pointdev/
├── src/
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── CaptureControls.tsx
│   │   │   ├── LiveFeedback.tsx
│   │   │   ├── OutputView.tsx
│   │   │   └── CopyButton.tsx
│   │   └── hooks/
│   │       ├── useSpeechRecognition.ts
│   │       └── useCaptureSession.ts
│   ├── background/
│   │   └── service-worker.ts
│   ├── content/
│   │   ├── index.ts
│   │   ├── element-selector.ts
│   │   ├── canvas-overlay.ts
│   │   ├── cursor-tracker.ts
│   │   └── react-inspector.ts
│   ├── shared/
│   │   ├── types.ts
│   │   ├── messages.ts
│   │   └── formatter.ts
│   └── manifest.json
├── public/
│   └── icons/
├── docs/
├── tests/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── LICENSE
```
