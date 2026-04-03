# UI Overhaul Sprint 2: Sidepanel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the sidepanel idle and output states using Sprint 1's M3 design system. Keep capture-state components (CaptureControls, LiveFeedback) unchanged — they move to the floating card in Sprint 3.

**Architecture:** Replace inline styles and styles.css classes with Tailwind utility classes + M3 component library from Sprint 1. Introduce permission checking hooks. Remove styles.css when all components are migrated.

**Tech Stack:** React 18, Tailwind CSS v4, shadcn/ui components (Button, Badge, SegmentedButton, PermissionRow, Card, ScrollArea), Lucide icons.

**Spec:** `docs/superpowers/specs/2026-04-03-ui-overhaul-design.md` (Sidepanel Screens section)

---

## File Structure

### New Files
- `src/sidepanel/components/IdleView.tsx` — Idle state: header, engine toggle, permission rows, start button
- `src/sidepanel/components/OutputView.tsx` — Rewritten output state (replaces current)
- `src/sidepanel/components/ScreenshotThumbnail.tsx` — Rewritten with M3 Badge (replaces current)
- `src/sidepanel/hooks/usePermissionStatus.ts` — Hook to check mic, activeTab, scripting, service worker status
- `tests/sidepanel/components/IdleView.test.tsx`
- `tests/sidepanel/components/OutputView.test.tsx`
- `tests/sidepanel/hooks/usePermissionStatus.test.ts`

### Modified Files
- `src/sidepanel/App.tsx` — Simplified: routes between IdleView, capture state, and OutputView
- `src/sidepanel/main.tsx` — Remove styles.css import

### Removed Files
- `src/sidepanel/styles.css` — Replaced by Tailwind utilities
- `src/sidepanel/components/CopyButton.tsx` — Replaced by inline Button usage

---

### Task 1: Create usePermissionStatus hook

**Files:**
- Create: `src/sidepanel/hooks/usePermissionStatus.ts`
- Create: `tests/sidepanel/hooks/usePermissionStatus.test.ts`

The hook checks the status of all permissions shown in the idle state: Microphone, Active Tab, Scripting, Offscreen Doc, Service Worker. Returns an array of `{ name, status, label, action?, onAction? }` objects compatible with PermissionRow.

### Task 2: Create IdleView component

**Files:**
- Create: `src/sidepanel/components/IdleView.tsx`
- Create: `tests/sidepanel/components/IdleView.test.tsx`

Layout: Header (logo + "PointDev" + version) → divider → Voice Engine segmented button → Status permission rows → Start Capture button → warning text if needed. Uses SegmentedButton, PermissionRow, Button from Sprint 1 ui/ components.

### Task 3: Rewrite OutputView with M3 design

**Files:**
- Rewrite: `src/sidepanel/components/OutputView.tsx`
- Create: `tests/sidepanel/components/OutputView.test.tsx`

Layout: Header (logo + "Capture Complete" + metadata) → stats grid (3 columns) → format SegmentedButton → dark code block → screenshot gallery → Copy + New buttons. Uses SegmentedButton, Button, Badge, ScrollArea.

### Task 4: Rewrite ScreenshotThumbnail with M3 Badge

**Files:**
- Rewrite: `src/sidepanel/components/ScreenshotThumbnail.tsx`

Replace inline triggerColor() with M3 Badge variants. Use M3 border/radius tokens. Keep the same props interface.

### Task 5: Rewrite App.tsx to use new components

**Files:**
- Rewrite: `src/sidepanel/App.tsx`

Route: idle → IdleView, preparing → loading indicator, capturing → existing CaptureControls+LiveFeedback (unchanged), complete → new OutputView. Move engine state and speech hooks into App (they stay here since IdleView needs engine selection and capture needs speech).

### Task 6: Remove styles.css and clean up

**Files:**
- Remove: `src/sidepanel/styles.css`
- Modify: `src/sidepanel/main.tsx` — remove styles.css import
- Remove: `src/sidepanel/components/CopyButton.tsx` — replaced by Button

Verify CaptureControls and LiveFeedback still work (they use styles.css classes). If they break, add equivalent Tailwind classes inline. These components are temporary — they move to the floating card in Sprint 3.

### Task 7: Final verification

- Run full test suite
- Production build
- Visual check in Chrome
