# Pending Fixes — Post-MVP Testing

> **Status:** Ready to implement. These were identified during manual E2E testing on 2026-03-15.

---

## PR: Fix canvas annotation scroll anchoring

**Priority:** High — annotations are visually broken during scroll

**Root cause:** `CanvasOverlay.drawnAnnotations` in `src/content/canvas-overlay.ts` stores viewport coordinates (`clientX/Y`). `redraw()` draws at those same viewport positions regardless of scroll. No scroll listener exists to trigger redraw. Result: drawn circles/arrows stay stuck to the viewport instead of following the page content when user scrolls.

**The data is correct** — `completeAnnotation()` adds `scrollX/Y` to produce page-relative coordinates in the `AnnotationData` sent to the service worker. Only the visual rendering is broken.

**Fix (3 changes in `src/content/canvas-overlay.ts`):**

1. **Store page-relative coordinates in `drawnAnnotations`** — when pushing to the array, add `window.scrollX/Y` to `cx/cy` and `sx/sy` at draw time (same conversion already done for the annotation data).

2. **`redraw()` converts page-relative back to viewport-relative** — subtract current `window.scrollX/Y` when drawing. Annotations that scroll off-screen draw outside the canvas bounds (invisible, correct).

3. **Add a scroll event listener** in the constructor (or in `startCapture`) that calls `redraw()` on every scroll event (throttled via `requestAnimationFrame` to avoid jank). Remove the listener in `destroy()`.

**Test:** Draw a circle on an element, scroll the page, circle should visually follow the element.

---

## PR: Fix message channel "closed before response" errors

**Priority:** Medium — console noise, no functional impact

**Root cause:** `chrome.runtime.sendMessage` broadcasts to ALL extension contexts (service worker, sidepanel, offscreen document). Each context's `onMessage` listener returns `true` (indicating async response), but messages like `OFFSCREEN_SPEECH_RESULT` have no handler in the service worker or sidepanel's capture session listener. Chrome logs "message channel closed before response received."

**Fix:** In each `onMessage` listener, only return `true` for message types that handler actually processes. Return `false` or `undefined` for unrecognized types.

**Files:**
- `src/background/service-worker.ts` — only return `true` for known message types
- `src/sidepanel/hooks/useCaptureSession.ts` — only handle `SESSION_UPDATED`, `CAPTURE_COMPLETE`, `CAPTURE_ERROR`
- `src/content/index.ts` — only return `true` for `PING`, `INJECT_CAPTURE`, `REMOVE_CAPTURE`, `MODE_CHANGED`

---

## Other known issues from testing

- **First click after Start Capture fails** — content script not yet injected. Second click works (PING succeeds). This is because declarative `content_scripts` injection runs at `document_idle` on page load, but if the page was already loaded before the extension was installed, the content script isn't present until page reload. Consider adding a "Reload page to enable capture" message when PING fails, or fall back to `executeScript` with the correct CRXJS-built path.

- **Tab URL shows `undefined` in service worker logs** — `activeTab` permission doesn't populate URL in `tabs.query` or `tabs.get` results from service worker context. Fixed by getting URL from content script response to `INJECT_CAPTURE`, but the first log line still shows undefined (cosmetic).

- **Microphone permission** — offscreen document with `getUserMedia` approach is implemented but untested (user didn't reload after the last fix that added `getUserMedia` before `SpeechRecognition.start()`). Needs verification on next test.
