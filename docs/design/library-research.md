# Library Research — March 2026

> Research into open source libraries for potential integration with PointDev.
> Conducted during Session 9 (2026-03-17).

---

## rrweb — Session Replay

**Repository:** https://github.com/rrweb-io/rrweb
**License:** MIT
**Used by:** Sentry, PostHog, DataDog, Pendo, Highlight

### What it does

Open source web session replay. Records DOM mutations via MutationObserver, user interactions (mouse, clicks, scroll, input), and media state. Produces a JSON event stream that can be replayed pixel-perfectly in the browser.

### What it captures

| Capability | Supported | Notes |
|-----------|-----------|-------|
| DOM snapshots (full + incremental) | Yes | Core feature |
| User interactions (mouse, click, scroll) | Yes | Configurable sampling |
| Console logs | Yes | Via plugin (@rrweb/rrweb-plugin-console-record) |
| Canvas content | Yes | 3 methods with different tradeoffs |
| Computed styles | Partial | Inlines CSS for hover states, not live computed |
| React/Vue/Svelte components | No | Would need separate instrumentation |
| Network requests | No | Separate plugin needed |

### Relevance to PointDev

**High value for future milestones:**
- DOM snapshots at annotation timestamps (issue #19)
- Full session replay as an output format
- Console capture plugin aligns with M3 (console/network errors)

### Blocker: Chrome Extension Compatibility

rrweb inlines a base64-encoded Web Worker into the bundle. At runtime it decodes and spawns the worker via `Blob` + `new Worker()`. Chrome Web Store rejects this as obfuscated code ("Red Titanium" violation). Open issue #1699, unresolved for 2+ years.

**Workarounds:**
1. Fork and patch to load worker from a separate file via `chrome.runtime.getURL()`
2. Use rrweb in a non-content-script context (sidepanel/popup) and proxy events
3. Wait for upstream fix (unlikely soon)

### Performance

- ~55-60 KB minified (before gzip), reducible to ~29 KB with tree-shaking
- +60 MB memory when enabled (Sentry benchmark)
- Configurable sampling to reduce overhead

### Verdict

**Future milestone target, not PoC.** The Chrome extension CSP blocker makes it impractical for the current proof of concept. When the upstream issue is resolved (or we fork/patch), rrweb would be excellent for:
- M1: DOM snapshots at annotation timestamps
- M3: Console error capture via plugin
- M6: Session replay as a bridge server output format

**Action:** Monitor rrweb issue #1699. Consider forking for M1 if not resolved by then.

---

## html2canvas — DOM-to-Canvas Screenshots

**Repository:** https://github.com/niklasvh/html2canvas
**Aerobotics fork:** https://github.com/Aerobotics/html2canvas (minor version bump only)
**License:** MIT

### What it does

Renders HTML elements as canvas images by reading the DOM and reconstructing the visual representation. Entirely client-side, no server needed.

### Limitations

- Library's own FAQ: **"You shouldn't use html2canvas in a browser extension."**
- Doesn't capture actual pixels — reconstructs from DOM properties
- Limited CSS support (no filters, shadows, gradients, pseudo-elements in many cases)
- Cross-origin content requires a proxy
- Library self-describes as "very experimental state"

### Relevance to PointDev

**None.** We already use `chrome.tabs.captureVisibleTab()` which produces actual pixel-perfect screenshots with zero DOM reconstruction overhead. html2canvas would be a downgrade.

### Verdict

**Skip entirely.** The Aerobotics fork adds nothing meaningful over the original.

---

## pi-annotate — Element Annotation for Pi Coding Agent

**Repository:** https://github.com/nicobailon/pi-annotate
**Author:** Nico Bailon
**License:** MIT
**npm:** pi-annotate v0.3.6

### What it does

Visual annotation tool for the Pi coding agent. Chrome extension + native messaging bridge. Users click elements on a page, add per-element comments via inline draggable note cards, and submit structured feedback to the agent. Captures CSS selectors, box models, accessibility info, computed styles, and screenshots.

### Architecture

Four cooperating MV3 contexts (similar to PointDev):
- **Content script** (~2700 lines vanilla JS): element picker, note cards, SVG connectors, hover tooltips
- **Background script**: tab management, screenshot capture, native messaging
- **Native host** (Node.js): Unix socket bridge to Pi agent with auth token
- **Pi extension** (TypeScript): registers `/annotate` command, formats results

### What it captures

**Always:**
- CSS selector (ID, tag.classes, nth-of-type path)
- Bounding rect (page-relative)
- Box model (content, padding, border, margin)
- Accessibility (ARIA role, name, description, focusable, disabled, states)
- Key styles (display, position, overflow, zIndex, opacity, color, fontSize, etc.)
- Text content (first 500 chars)
- HTML attributes

**Debug mode:**
- 40+ computed CSS properties (layout, flexbox, grid, colors, typography, transforms)
- Parent context (parent tag, ID, classes, layout styles)
- CSS custom properties (up to 50, discovered via recursive stylesheet scan)

### Features PointDev could adopt

| Pattern | Value for PointDev | Milestone |
|---------|-------------------|-----------|
| `getAccessibilityInfo()` — ARIA roles, names, focusable state | WCAG detection layer | M3 |
| `getBoxModel()` — content/padding/border/margin breakdown | Richer element context | M1 |
| Element ancestry cycling (Alt+scroll to select parent/child) | Better element selection UX | M1 |
| Per-element screenshot cropping (20px padding) | Annotation-scoped screenshots | Issue #19 |
| CSS variable discovery via recursive stylesheet scan | Advanced style debugging | M1 |
| Debug mode toggle for verbose vs. compact output | Output format flexibility | M4 |

### How PointDev differs

| pi-annotate | PointDev |
|------------|----------|
| Per-element inline comments (typed) | Voice narration (spoken, timestamped) |
| Click-to-select only | Click + circle + arrow annotations |
| No temporal dimension | Cursor dwell tracking correlates gaze with speech |
| Structured markdown output for Pi agent | Structured prompt format for any AI tool |
| Native messaging bridge (Unix socket) | Chrome runtime messaging |
| No voice, no cursor tracking | Voice + cursor + annotations synchronized |

### Verdict

**Most relevant library. Cite as prior art, adapt patterns.**

pi-annotate and PointDev are complementary tools. pi-annotate is precise per-element feedback (click, comment, screenshot). PointDev is rich contextual feedback with temporal correlation (talk while pointing, draw while explaining).

**For the NLnet application:** Add to competitive section: "pi-annotate (Nico Bailon, MIT) captures per-element comments and DOM context for the Pi coding agent. PointDev adds temporal correlation — voice, cursor dwell, and canvas annotations synchronized with timestamps — and compiles into a structured format any tool can consume."

**For implementation:** Adapt accessibility capture for M3. Reference box model pattern for M1. Credit Nico Bailon / pi-annotate in code comments where patterns are adopted.

---

## Agent Validation Feedback (2026-03-16)

Separate from library research: PointDev output was tested on an AI coding agent (Claude) managing a live website. The agent successfully parsed the output, identified three UI issues, and provided specific feedback on what would make the output more actionable.

### What the agent requested

| Request | Priority | Status |
|---------|----------|--------|
| Screenshots at annotation timestamps | High | Issue #19 |
| Source file mapping (selector to file:line) | High | Issue #20 |
| Computed styles on annotated elements | Medium | Issue #21 |
| DOM subtree per annotation | Medium | Issue #21 |
| Annotation intent classification (problem/reference/target) | Low | Not filed |
| Diff from design reference | Low | Not filed |

### Key quote

> "Loom for humans, annotated screenshots + structured metadata for agents. Same capture session, two output formats."

### What the agent deprioritized

- Cursor dwell data: "interesting for understanding priority but not actionable for fixing"
- Pixel coordinates without screenshots: "not very useful"
- Full video / session replay: "I can't watch it"

---

## Integration Roadmap

### Short-term (PoC, before grant)
- None of the three libraries should be integrated into the current PoC
- pi-annotate patterns can inform M1-M3 design decisions
- Agent validation feedback (issues #19-#21) should be addressed in the PoC if time allows

### Medium-term (M1-M3, if funded)
- Adopt pi-annotate's accessibility capture pattern for M3 (WCAG detection)
- Adopt box model extraction for richer element context in M1
- Implement annotation-scoped screenshots (issue #19) using existing `captureVisibleTab`

### Long-term (M4-M7, if funded)
- Investigate rrweb integration once Chrome extension CSP issue is resolved
- Consider rrweb for session replay output format in M6 (bridge server)
- Source file mapping (issue #20) via React fiber `_debugSource` for M7

### Attribution

Any patterns adapted from pi-annotate will credit:
- **pi-annotate** by Nico Bailon (MIT License) — https://github.com/nicobailon/pi-annotate
- Specific functions credited in code comments where adapted
