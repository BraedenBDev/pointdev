# UI Overhaul Sprint 3: Floating Card Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace sidepanel capture controls with a floating card injected into the page as a Shadow DOM content script overlay. Sidepanel closes during capture, reopens with results.

**Architecture:** The floating card is vanilla TypeScript (not React) living in the content script context. It uses Shadow DOM for CSS isolation. Messages flow: floating card → service worker → session store. The service worker orchestrates sidepanel open/close.

---

## Task 1: Create FloatingCard class

Create `src/content/floating-card.ts` — a self-contained class that:
- Creates a Shadow DOM host element on document.body
- Renders the card HTML (expanded + collapsed states)
- Handles mode button clicks → sends SET_MODE to service worker
- Handles stop button click → sends STOP_CAPTURE to service worker
- Updates timer, transcript snippet, annotation/screenshot counts
- Supports drag (header bar only)
- Supports collapse/expand toggle
- Position persistence via chrome.storage.local
- Z-index: 2147483647 (above canvas overlay at 2147483646)

## Task 2: Create floating card styles

Create `src/content/floating-card.css` — M3 styles for the card, inlined into Shadow DOM. Uses the same desaturated teal palette. Glassmorphism (backdrop-filter: blur). Light/dark mode via prefers-color-scheme.

## Task 3: Wire FloatingCard into content script lifecycle

Modify `src/content/index.ts`:
- In startCapture(): create and show FloatingCard
- In stopCapture(): destroy FloatingCard
- Add message handler for TRANSCRIPT_SNIPPET (new message from SW)
- Add message handler for SESSION_STATS (new message from SW with counts)
- Exclude FloatingCard host element from annotation event handlers

## Task 4: Update service worker for sidepanel lifecycle

Modify `src/background/service-worker.ts` and `src/background/message-handler.ts`:
- On START_CAPTURE: close sidepanel (via window management or navigation)
- On STOP_CAPTURE: reopen sidepanel with sidePanel.open()
- Route TRANSCRIPT_UPDATE summaries to content script as TRANSCRIPT_SNIPPET
- Route session stats to content script as SESSION_STATS
- Add new message types to HANDLED_TYPES

## Task 5: Update shared message types

Modify `src/shared/messages.ts`:
- Add TRANSCRIPT_SNIPPET message type (SW → content script)
- Add SESSION_STATS message type (SW → content script)
- Add FLOAT_STOP message type (content script → SW, from floating card stop button)

## Task 6: Tests + verification

- Unit tests for FloatingCard class (DOM creation, state toggling, message sending)
- Integration test: message flow between floating card and service worker
- Full test suite + production build
