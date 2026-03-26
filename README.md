<div align="center">
<img src="docs/images/logo.svg" alt="PointDev logo" width="120" />
    
# PointDev

**Structured browser context capture for AI coding tools**

Talk, draw, and click in your browser. PointDev captures the technical context and your intent, then compiles it into a structured prompt any AI agent can act on.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?style=flat&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Bun](https://img.shields.io/badge/Bun-Runtime-000?style=flat&logo=bun&logoColor=white)](https://bun.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat)](CONTRIBUTING.md)
[![GitHub Issues](https://img.shields.io/github/issues/braedenbdev/pointdev?style=flat&logo=github)](https://github.com/BraedenBDev/pointdev/issues)

[Getting Started](#quickstart) · [How It Works](#how-it-works) · [Features](#features) · [Roadmap](#roadmap) · [Contributing](CONTRIBUTING.md)

</div>

---

## What is PointDev?

You spot a problem in your browser. You switch to Claude Code and type "the hero font is too small." The agent has to guess which file, which component, what the current size is, and what "too small" means. The DOM path, component name, computed styles, and your spatial intent are all lost.

Browser automation gives AI agents eyes. PointDev gives humans a voice.

PointDev captures technical context (element selector, DOM subtree, computed styles, React component name, device metadata) and human context (timestamped voice narration, canvas annotations, cursor dwell behavior) simultaneously, then compiles everything into structured output any downstream tool can consume.

**Key highlights:**

- **Talk, draw, click** all at the same time during a single capture session
- **Five annotation tools** — circle, arrow, freehand, rectangle, and element selection
- **Temporal correlation** links what you're pointing at with what you're saying
- **Smart screenshots** auto-captured when you talk, dwell, or scroll — powered by real-time frame differencing
- **Console + network capture** catches errors and failed requests alongside your feedback
- **Works on any web page**, with opportunistic React component detection
- **Copy and paste** the structured output into any AI coding tool

### Real Output

This is actual output from PointDev, captured on a live site:

```
## Context
- URL: https://almostalab.io/
- Page title: Almost A Lab — Building the Future of AdTech
- Viewport: 1677 x 1145px
- Captured at: 2026-03-15 15:12:20

## User Intent (voice transcript)
[00:04] "I think the"
[00:06] "main hero"
[00:09] "is far too"
[00:11] "large"
[00:15] "and we need to adjust the line breaking"
[00:19] "two or three lines at Max"
[00:23] "and there is a problem at the bottom here"
[00:26] "where you scroll CTA"
[00:32] "overlapping with the"
[00:35] "subtitle of the page"

## Annotations
1. [00:40] Circle around .lg\:min-h-\[100svh\] at (42, 1019), radius 131px

## Cursor Behavior
- [00:07-00:32] Dwelled 25.5s over h1.font-display.text-hero (during: "main hero")
- [00:25-00:32] Dwelled 7.3s over div.absolute.bottom-10 (during: "scroll CTA")
- [00:29-00:36] Dwelled 6.2s over div.absolute.bottom-10 (during: "overlapping with the")
```

### What an AI Agent Does With This

We pasted PointDev output into a Claude Code session managing the live website. Without any prior context, the agent:

1. **Identified three UI issues** from the voice transcript, annotations, and cursor dwell data
2. **Mapped each issue to specific elements** (the `h1.font-display`, `div.absolute.bottom-10` overlap, padding mismatch)
3. **Offered to fix all three immediately**, asking only "Want me to look at the Hero component and fix these alignment/spacing issues?"

The agent also described what would make the output even more actionable:

> "The ideal output for an agent is: screenshot + voice intent + source file:line + computed styles on each annotation target. That's a one-shot fix with no exploration needed."

> "Loom for humans, annotated screenshots + structured metadata for agents. Same capture session, two output formats."

That feedback is now driving our [roadmap](#roadmap).

---

## Quickstart

> **Status: Proof of Concept.** Working demo, not a production release.
>
> Requires [Bun](https://bun.sh) and Chrome.

```bash
git clone https://github.com/BraedenBDev/pointdev.git
cd pointdev
bun install
bun build
```

1. Open `chrome://extensions/`, enable **Developer Mode**
2. Click **Load unpacked** and select the `dist/` folder
3. Open any web page, click the PointDev icon to open the sidepanel
4. Click **Setup Microphone** if you want voice narration (one-time, tab auto-closes)
5. Chrome will prompt to approve the **tab capture** permission on first use

---

## How It Works

```mermaid
flowchart LR
    subgraph Browser Tab
        CS[Content Script]
        MW[Main World<br/>Console/Network]
    end
    subgraph Extension
        SP[Sidepanel<br/>React UI + Speech]
        SI[Screenshot<br/>Intelligence]
        SW[Service Worker<br/>State + Capture]
    end

    SP -- START_CAPTURE --> SW
    SW -- INJECT_CAPTURE --> CS
    SW -- TAB_STREAM_READY --> SI
    CS -- element, annotation,<br/>cursor --> SW
    MW -- CustomEvent --> CS
    CS -- CONSOLE_BATCH --> SW
    SW -- DWELL_UPDATE --> SI
    SP -. voice signal .-> SI
    SI -- SMART_SCREENSHOT --> SW
    SW -- SESSION_UPDATED --> SP
```

**Sidepanel (React):** Capture controls, live feedback, voice transcription (Web Speech API runs here directly), screenshot thumbnails with copy-to-clipboard, compiled output display.

**Service Worker:** Coordinates state between sidepanel and content script. Holds the `CaptureSession`, routes messages, captures full-resolution screenshots via `captureVisibleTab`, provides `tabCapture` stream IDs for the intelligence module, runs real-time dwell detection, injects main-world console/network capture script.

**Content Script:** Injected into the active page. Handles element selection (with Alt+scroll ancestry cycling), canvas annotation overlay (circle, arrow, freehand, rectangle), cursor tracking, React component detection, and CSS variable discovery.

**Screenshot Intelligence (Sidepanel):** Receives a `tabCapture` MediaStream and samples low-res frames (160x90) every 2 seconds. Compares frames via sparse pixel differencing and combines the result with cursor dwell and voice activity signals to produce a weighted interest score. Screenshots are only captured when the score exceeds a threshold, avoiding noise while catching meaningful moments.

**Main World Script:** Injected into the page's JavaScript world via `chrome.scripting.executeScript({ world: 'MAIN' })`. Monkey-patches `console.error/warn`, `fetch`, and `XMLHttpRequest` to capture errors and failed requests. Bridges data back to the content script via `CustomEvent`.

All capture data flows into a single `CaptureSession` object with timestamps relative to recording start. A template formatter compiles this into structured output.

---

## Features

**Technical context (captured automatically):**

| Feature | Description |
|---------|-------------|
| CSS selector + DOM subtree | Click any element to capture its selector and surrounding HTML |
| Computed styles + box model | font-size, color, spacing, display, position, content/padding/border/margin dimensions |
| CSS custom properties | Discovers `--variable` declarations from matching stylesheet rules |
| React component detection | Resolves component name via `__reactFiber$` internals |
| Console errors + network failures | Captures `console.error/warn`, failed fetch/XHR, uncaught exceptions, unhandled rejections |
| Page + device metadata | URL, title, viewport, browser, OS, screen size, pixel ratio, touch, color scheme |
| Cursor dwell tracking | Records which elements you hover over and for how long |
| Smart screenshots | Auto-captured by multi-signal intelligence: frame diff (CV), cursor dwell, voice activity, annotations |

**Human context (your input):**

| Feature | Description |
|---------|-------------|
| Voice narration | Speak naturally; transcription runs live with timestamps |
| Visual annotations | Circle, arrow, freehand, and rectangle tools |
| Element selection | Click to select, Alt+scroll to cycle through parent/child elements |

**Everything is temporally correlated.** The cursor dwell data shows which element you were pointing at when you said each phrase. Annotations are timestamped to align with your voice. Screenshots are enriched with the voice context from the moment you drew the annotation.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Chrome Manifest V3 |
| UI | React 18, TypeScript |
| Build | Vite + CRXJS |
| Runtime | Bun |
| Canvas | HTML5 Canvas API (annotation overlay) |
| Voice | Web Speech API |
| Testing | Vitest (784 tests) |

---

## Project Structure

```
pointdev/
├── src/
│   ├── background/         # Service worker, message handler, session store
│   ├── content/            # Element selector, canvas overlay, cursor tracker,
│   │                       # React inspector, device metadata, console/network capture
│   ├── shared/             # Types, message definitions, template formatter,
│   │                       # dwell computation
│   └── sidepanel/          # React UI: App, hooks, components, screenshot intelligence
├── public/                 # Mic-permission page, icons
├── tests/                  # Vitest unit tests (mirrors src/ structure)
├── docs/
│   ├── design/             # MVP spec, implementation plan, library research
│   ├── superpowers/        # Feature specs and implementation plans
│   └── genai-disclosure/   # AI-assisted development log
├── CLAUDE.md               # AI agent guidance for this codebase
├── CONTRIBUTING.md         # Dev setup, testing, commit conventions
└── README.md
```

---

## Permissions

PointDev requests minimal Chrome permissions:

| Permission | Why |
|---|---|
| `activeTab` | Access the current tab when you start a capture |
| `scripting` | Inject content script + main-world console/network capture |
| `sidePanel` | The extension UI |
| `storage` | Persist capture session and mic permission state |
| `<all_urls>` (host) | Required for periodic screenshot capture during active sessions (`captureVisibleTab` from sidepanel context needs host permission — `activeTab` alone doesn't work from sidepanel timers) |

Screenshots are only captured during active capture sessions you explicitly start. No background access to your browsing. No data leaves your machine except Web Speech API audio, which Chrome sends to Google for transcription. Local speech-to-text is on the [roadmap](#roadmap).

---

## Roadmap

- [x] Element selection with CSS selector, computed styles, box model, DOM subtree
- [x] React component detection via fiber internals
- [x] CSS custom property discovery on selected elements
- [x] Canvas annotation overlay (circle, arrow, freehand, rectangle) with scroll anchoring
- [x] Element ancestry cycling (Alt+scroll to select parent/child)
- [x] Voice transcription with timestamped segments (sidepanel-native)
- [x] Cursor dwell tracking with temporal correlation
- [x] Device metadata capture
- [x] Smart screenshots via multi-signal intelligence (frame diff + dwell + voice + annotations)
- [x] Console errors + failed network request capture (main-world injection)
- [x] Compiled structured output with copy-to-clipboard
- [ ] Source file path resolution from selectors ([#20](https://github.com/BraedenBDev/pointdev/issues/20))
- [ ] Tab video recording for session replay
- [ ] Accessibility capture (ARIA roles, names) ([#23](https://github.com/BraedenBDev/pointdev/issues/23))
- [ ] Multi-element selection ([#13](https://github.com/BraedenBDev/pointdev/issues/13))
- [ ] Text annotation tool
- [ ] Local speech-to-text via Whisper ([#7](https://github.com/BraedenBDev/pointdev/issues/7))
- [ ] Pluggable output formats: JSON, Markdown, MCP ([#10](https://github.com/BraedenBDev/pointdev/issues/10))
- [ ] Vue and Svelte component detection ([#9](https://github.com/BraedenBDev/pointdev/issues/9))
- [ ] Direct delivery to AI tools via bridge server ([#12](https://github.com/BraedenBDev/pointdev/issues/12))

See all [open issues](https://github.com/BraedenBDev/pointdev/issues) for the full backlog.

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, coding standards, and commit conventions.

Look for issues labeled [**good first issue**](https://github.com/BraedenBDev/pointdev/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) and [**help wanted**](https://github.com/BraedenBDev/pointdev/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22).

---

## AI-Assisted Development Disclosure

This project is built using AI coding tools (Claude Code, Cursor) as the primary implementation workflow. The developer architects solutions, defines acceptance criteria, and reviews all code. AI agents execute implementation tasks under human direction.

Commits from AI agents use `Co-Authored-By` tags so they are distinguishable from human-authored commits. All code is reviewed, tested, and validated by the maintainer before merging. Architectural decisions are made by the human lead.

This is directly relevant to PointDev's mission: we're building a tool that improves the input side of human-to-AI-coder communication, and we're building it with those same tools.

Full development log: [`docs/genai-disclosure/development-log.md`](docs/genai-disclosure/development-log.md)

---

## License

MIT. See [LICENSE](LICENSE).

---

<div align="center">

**[github.com/BraedenBDev/pointdev](https://github.com/BraedenBDev/pointdev)** · Built by [Braeden Bihag](https://almostalab.io) at [Almost a Lab](https://almostalab.io)

</div>
