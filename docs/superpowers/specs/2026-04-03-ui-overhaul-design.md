# PointDev UI Overhaul — Design Spec

## Summary

Replace the sidepanel-only UI with a three-surface architecture: floating card (capture controls), offscreen document (voice recognition), and sidepanel (setup + results). Restyle everything with shadcn/ui components + Material Design 3 overrides using a desaturated teal color system.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Design direction | Polished & branded, M3-native | Developer tool that looks Google-native, not generic |
| Scope | Full UI overhaul | Layout, interactions, animations, onboarding, gallery, output |
| Brand color seed | Desaturated teal (#1d9972) | Fresh, action-oriented ("go"/"capture"), softer than saturated green |
| Component library | shadcn/ui + M3 styling overrides | Radix accessibility + shadcn patterns, restyled to feel Material |
| Implementation approach | Foundation first | Design system layer → then rewrite screens top-to-bottom |
| Capture UI | Floating card (content script) | Page keeps full width. Follows BugHerd/Marker.io/Loom pattern |
| Voice location | Offscreen document | Decouples voice from sidepanel. Both engines work in offscreen docs |
| Results UI | Sidepanel | Stays open, no context switch, full Chrome API access |

## Architecture

### Three Surfaces

**Sidepanel** (extension page — idle + complete states only)
- Before capture: engine selection, permission status, start button
- After capture: output view, screenshot gallery, copy, new capture
- Closes when capture starts, reopens when capture ends

**Floating Card** (content script — during capture only)
- Shadow DOM for CSS isolation from host page
- Mode buttons: select, circle, arrow, freehand, rectangle
- Recording indicator + timer
- Live transcript snippet (last line)
- Annotation/screenshot counts
- Stop button
- States: expanded (default), collapsed (pill: ● 00:14), draggable
- Auto-collapse after 5s of no interaction, re-expand on events

**Offscreen Document** (hidden extension page — during capture only)
- Hosts voice recognition for both engines
- Fast mode: Web Speech API (SpeechRecognition)
- Private mode: getUserMedia → AudioContext → Whisper Worker
- Sends transcripts to service worker via chrome.runtime messaging
- Created on capture start, destroyed on capture stop

### Flow

```
① IDLE — Sidepanel open
   User sees: engine toggle, permission status rows, Start button
   
② User clicks Start (user gesture in sidepanel)
   → Sidepanel sends START_CAPTURE to service worker
   → Service worker creates offscreen document (voice)
   → Service worker injects floating card + canvas overlay
   → Sidepanel navigates to a minimal "capture active" page (or closes via window.close())
   → Service worker injects floating card + canvas overlay into page
   → Content script captures begin (cursor, elements, annotations)
   
③ CAPTURING — No sidepanel, full-width page
   Floating card shows controls in bottom-right corner
   Voice transcripts: offscreen doc → service worker → floating card
   Annotations/screenshots: content script → service worker
   
④ User clicks Stop on floating card
   → Floating card sends STOP_CAPTURE to service worker
   → Service worker compiles session
   → Floating card removed from page
   → Offscreen document destroyed
   → Service worker calls sidePanel.open() (Chrome 116+, triggered by user gesture on floating card)
   → Sidepanel renders output view
   Note: sidePanel.open() requires a user gesture. The Stop button click in the
   content script qualifies as a user interaction on an extension page context.
   If open() fails, the extension icon badge updates to signal "results ready".
```

### Message Flow

```
Floating Card ↔ Service Worker ↔ Offscreen Doc
     ↕                ↕
Content Script    Session Store
(overlay, cursor,
 elements)
```

## Design System

### Color Palette (desaturated teal, -15% saturation)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Primary | #1d9972 | #4dd4a3 | Buttons, active states, brand |
| Primary Container | #eefdf6 | rgba(29,153,114,0.15) | Tonal buttons, selected backgrounds |
| Surface | #f8fafb | #1a1a2e | Page backgrounds |
| Surface Variant | #f1f4f6 | #2a2a3e | Cards, inputs |
| On Surface | #1e293b | #e2e8f0 | Primary text |
| On Surface Variant | #4b5563 | #9ca3af | Secondary text |
| Outline | #e4e8ec | rgba(255,255,255,0.08) | Borders |
| Error | #d64545 | #d64545 | Errors, stop button, recording dot |
| Error Container | #fef4f4 | rgba(214,69,69,0.15) | Error backgrounds |
| Muted | #888 | #888 | Labels, timestamps |

### Typography

| Role | Font | Size | Weight |
|------|------|------|--------|
| Display | Inter | 15px | 600 |
| Body | Inter | 12-13px | 400 |
| Label | Inter | 10-11px | 500, uppercase, tracking 0.05em |
| Mono | JetBrains Mono | 10-11px | 400 |

### Shape (M3)

| Token | Radius | Usage |
|-------|--------|-------|
| Small | 8px | Permission rows, inputs, badges |
| Medium | 10-12px | Cards, segmented buttons, code blocks |
| Large | 16px | Floating card, sidepanel sections |
| Full | 20px+ | Buttons (pill shape), collapsed pill |

### Elevation

- Floating card: `box-shadow: 0 4px 24px rgba(0,0,0,0.12)` + `backdrop-filter: blur(16px)`
- Cards in sidepanel: `border: 1px solid outline-color` (no shadows, M3 outlined style)
- Code block: dark background (#1a1a2e), no shadow

## Component Inventory

Built with shadcn/ui primitives, restyled to M3:

| Component | shadcn Base | M3 Override | Used In |
|-----------|-------------|-------------|---------|
| Button | button | Pill shape (full radius), tonal/filled/outlined variants | Start, Stop, Copy, New |
| SegmentedButton | toggle-group | M3 segmented style with indicator | Engine toggle, format tabs |
| Card | card | Outlined (no shadow), medium radius | Permission rows, stat cards |
| Badge | badge | Rounded pill, trigger-color coded | Screenshot triggers |
| IconButton | button variant | Compact square, tonal background | Mode selectors in floating card |
| Progress | progress | Linear, primary color | Whisper model download |
| ScrollArea | scroll-area | Thin scrollbar, momentum scroll | Output view, transcript |
| Tooltip | tooltip | M3 plain tooltip style | Mode button labels |
| Tabs | tabs | Segmented button style (not underline) | Output format |

## Sidepanel Screens

### Idle State

Layout top-to-bottom:
1. **Header**: Logo (28px green square "P") + "PointDev" + version
2. **Divider**
3. **Voice Engine**: Label "VOICE ENGINE" + M3 segmented button (⚡ Fast / 🔒 Private) + description text
4. **Status**: Label "STATUS" + permission rows, each showing:
   - Green/red dot indicator
   - Permission name (Microphone, Active Tab, Scripting, Offscreen Doc, Service Worker)
   - Status text (Granted/Ready/Allowed/Available/Active or Denied/Restricted/Blocked)
   - Action link for fixable issues ("Setup →")
5. **Start Capture button**: Full-width, primary filled, pill shape
6. **Warning text** (conditional): If any permission blocks capture, explain why. If mic-only issue, note capture works without voice.

Start button is disabled (gray) if Active Tab or Scripting is blocked (restricted page). Enabled even if mic is denied (capture works without voice).

### Output State

Layout top-to-bottom:
1. **Header**: Logo + "Capture Complete" + metadata line (url · duration · segment count)
2. **Stats row**: 3-column grid — annotations count, screenshots count, voice segments count
3. **Format tabs**: M3 segmented button (Text / JSON / Markdown)
4. **Output code block**: Dark background, JetBrains Mono, scrollable, syntax-highlighted for Markdown
5. **Screenshots**: Label "SCREENSHOTS" + horizontal scroll row of thumbnails with timestamps. Click to expand.
6. **Actions**: "Copy [format]" primary button + "New" outlined button

## Floating Card

### Expanded State (260px wide)

1. **Header bar** (drag handle): Logo + "PointDev" + recording dot + timer. Click to collapse.
2. **Mode buttons**: 5 icon buttons in a row (Select/Circle/Arrow/Freehand/Rectangle). Active = primary filled, inactive = tonal.
3. **Stats line**: Mic indicator + annotation count + screenshot count
4. **Transcript snippet**: Last transcript line, single row, truncated
5. **Stop button**: Full-width, error color, pill shape

### Collapsed State (pill)

Recording dot + timer + divider + logo icon. Click to expand.

### Behavior

- **Position**: Default bottom-right. Draggable to any corner. Position persisted in chrome.storage.local.
- **Drag vs annotate**: Header bar is the drag handle. Canvas overlay ignores events originating from the Shadow DOM host element.
- **Auto-collapse**: After 5s of no interaction. Re-expands on mode change, new transcript, or annotation.
- **Dark mode**: Reads `prefers-color-scheme`. Glassmorphism (backdrop-filter: blur) adapts to both.
- **CSS isolation**: Full Shadow DOM. `pointer-events: auto` on card, page interaction unaffected outside card bounds.
- **Z-index**: `2147483647` (max). Above canvas overlay (`2147483646`).

## Offscreen Document

### Voice Architecture

```
Offscreen Document (offscreen.html)
├── Listens for: VOICE_START { engine, captureStartedAt }
├── Listens for: VOICE_STOP
├── Fast mode:
│   └── SpeechRecognition instance
│       → continuous, interimResults
│       → sends TRANSCRIPT_UPDATE to service worker
├── Private mode:
│   ├── getUserMedia({ audio: { sampleRate: 16000 } })
│   ├── AudioContext → ScriptProcessorNode → 3s chunks
│   └── Whisper Worker (same whisper-worker.ts)
│       → sends TRANSCRIPT_UPDATE to service worker
└── Cleanup: stop recognition/stream/worker on VOICE_STOP
```

### Lifecycle

- Created via `chrome.offscreen.createDocument()` on capture start
- Reasons: `['USER_MEDIA', 'AUDIO_PLAYBACK', 'WORKERS']`
- Destroyed via `chrome.offscreen.closeDocument()` on capture stop
- Only one offscreen document allowed per extension — check existence before creating

### New Permission

Add `"offscreen"` to manifest.json permissions array.

## Permissions (updated)

```json
["activeTab", "scripting", "sidePanel", "storage", "offscreen"]
```

No new host permissions. `<all_urls>` host permission stays for content script injection.

## Migration Path

### What Changes

| Current | New |
|---------|-----|
| Sidepanel hosts capture controls | Floating card (content script) |
| Voice runs in sidepanel | Voice runs in offscreen document |
| Sidepanel stays open during capture | Sidepanel closes during capture |
| Hand-written CSS | Tailwind + shadcn/ui + M3 tokens |
| System font stack | Inter + JetBrains Mono |
| Blue accent (#2563eb) | Desaturated teal (#1d9972) |

### What Stays

- Service worker architecture (session store, message handler)
- Content script injection (canvas overlay, cursor tracker, element selector)
- Screenshot intelligence (frame diff, dwell, voice signals)
- Output formatters (text, JSON, markdown)
- All existing tests (hook tests will need updates for offscreen migration)

### Decomposition into Sprints

**Sprint 1: Foundation**
- Install Tailwind CSS + configure for Chrome extension
- Install shadcn/ui, configure M3 theme overrides
- Add Inter + JetBrains Mono fonts
- Create base components (Button, Card, SegmentedButton, Badge)
- Verify build works with new dependencies

**Sprint 2: Sidepanel Redesign**
- Rewrite idle state with permission status rows
- Rewrite output state with new layout
- Add sidepanel open/close lifecycle (sidePanel.open() / close on capture start)
- Dark mode support

**Sprint 3: Floating Card**
- Create Shadow DOM container in content script
- Build floating card component (expanded + collapsed states)
- Implement drag behavior with position persistence
- Wire mode buttons, stats, transcript snippet to service worker messages
- Handle drag vs annotate conflict

**Sprint 4: Offscreen Document**
- Create offscreen.html + voice orchestration script
- Migrate Fast mode (Web Speech API) to offscreen context
- Migrate Private mode (Whisper Worker) to offscreen context
- Add offscreen permission to manifest
- Wire transcript messages: offscreen → service worker → floating card
- Update mic permission flow

**Sprint 5: Polish**
- Micro-interactions and animations (state transitions, collapse/expand)
- Screenshot gallery modal in output view
- Error states and edge cases
- Accessibility pass
- Final visual QA across light/dark modes
