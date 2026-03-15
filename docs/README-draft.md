# PointDev

Open source structured browser context capture for AI-assisted development.

PointDev is a Chrome extension that captures what you see in the browser — the element you're pointing at, what you say about it, where you draw attention — and compiles it into a structured prompt that AI coding agents can act on.

## The Problem

When you spot a problem in a browser, you take a screenshot, switch to your AI coding tool, and type something like "the font on the hero section is too small." Your AI agent then has to guess which file, which component, what the current font size is, and what you actually meant by "too small."

The DOM path, component name, computed styles, and your spatial intent are lost in translation. Every AI coding tool — Claude Code, Cursor, Aider — suffers from this input problem.

## What PointDev Does

PointDev captures technical context and human context simultaneously:

**Technical context (automatic):**
- CSS selector and DOM subtree of the element you click
- Computed styles (font-size, color, spacing, etc.)
- React component name (when available; source file path on dev builds only)
- Page URL, title, and viewport dimensions
- Cursor dwell behavior (what you're pointing at while talking)

**Human context (your input):**
- Voice narration — speak naturally about what you want changed
- Visual annotations — draw circles and arrows directly on the page
- Element selection — click the specific element you mean

**Structured output:**
Everything is compiled into a single structured prompt with timestamps that correlate your words with your annotations. Copy it, paste it into any AI coding tool, and the agent knows exactly what to do.

### Example Output

```
## Context
- URL: https://myapp.dev/landing
- Page title: My App — Landing
- Viewport: 1200 x 800px
- Captured at: 2026-03-20 14:32:05

## Target Element
- Selector: div.hero > h1
- React Component: <HeroSection>
- Computed: font-size: 32px, color: #1a1a1a, font-weight: 700
- DOM: <h1 class="hero-title">Welcome to Our Platform</h1>

## User Intent (voice transcript)
[00:18] "this whole section looks good but..."
[00:23] "and here, the font is far too small, lets increase 25%"

## Annotations
1. [00:23] Circle around div.hero > h1 at (340, 180), radius 85px

## Cursor Behavior
- [00:22–00:25] Dwelled 3.1s over div.hero > h1 (during: "the font is far too small")

## Screenshot
[base64 data URL]
```

## Installation

> **Status: Proof of Concept** — this is a working demo, not a production release.

1. Clone this repository
2. `pnpm install && pnpm build`
3. Open `chrome://extensions/`, enable Developer Mode
4. Click "Load unpacked" and select the `dist/` folder
5. Open any web page, click the PointDev icon to open the sidepanel

## Usage

1. Click **Start Capture** in the sidepanel
2. Talk, draw, click — simultaneously:
   - **Click** any element to capture its DOM context
   - **Toggle to Circle or Arrow** mode to annotate directly on the page
   - **Speak** to narrate what you want — transcription runs live
3. Click **Stop Capture**
4. Review the compiled structured prompt in the sidepanel
5. Click **Copy to Clipboard** and paste into your AI coding tool

## How It Works

PointDev is a Chrome Manifest V3 extension with three cooperating contexts:

- **Sidepanel (React)** — capture controls, live feedback, compiled output display, and voice transcription via Web Speech API
- **Service Worker** — coordinates state between sidepanel and content script, holds the capture session
- **Content Script** — injected into the active page for element selection, canvas annotation overlay, cursor tracking, and React component detection

All capture data flows into a single `CaptureSession` object with timestamps relative to recording start. A template formatter compiles this into the structured output.

### React Component Detection

When you click an element on a React page, PointDev inspects React fiber internals (`__reactFiber$`) to resolve the component name and source file. This works automatically on development builds and most production builds. If React isn't detected, it falls back to CSS selector + DOM subtree — the extension works on any web page.

## Permissions

PointDev requests minimal Chrome permissions:

| Permission | Why |
|---|---|
| `activeTab` | Access the current tab when you start a capture |
| `scripting` | Inject the content script for element selection and annotation |
| `sidePanel` | The extension UI |
| `storage` | Persist your preferences |

No background access to your browsing. No data leaves your machine (except Web Speech API audio, which Chrome sends to Google for transcription).

## Current Limitations

This is a proof of concept demonstrating the core capture-compile pipeline. Here's what we'd like to address with further development:

- **Transcription privacy** — Web Speech API sends audio to Google. A local transcription option (Whisper, on-device models) would keep everything on-machine.
- **Annotation tools** — Currently circle and arrow. Freehand, rectangles, and text labels would cover more use cases.
- **Framework coverage** — React component detection only. Vue and Svelte expose similar internals and could be supported with framework-specific adapters.
- **Structured output formats** — Output is currently plain text. A pluggable compiler with JSON, Markdown, and MCP-compatible adapters would enable programmatic consumption and standardization.
- **Console/network context** — Console errors and failed network requests are valuable debugging context, requiring `chrome.debugger` API with elevated permissions.
- **Direct tool integration** — Output goes via clipboard. A local bridge server could deliver context directly to Claude Code, Aider, and other tools.
- **Multi-element selection** — Currently captures one element per session. Multiple selections would support "these three buttons are inconsistent" type feedback.

## AI-Assisted Development Disclosure

This project is built using AI-assisted coding tools (Claude Code, Cursor) as the primary implementation workflow. The developer architects solutions, defines acceptance criteria, and reviews all code. AI coding agents execute implementation tasks under human direction.

- Commits from AI agents use `Co-Authored-By` tags so they are distinguishable from human-authored commits
- All code is reviewed, tested, and validated by the maintainer before merging
- Architectural decisions are made by the human lead

This is directly relevant to PointDev's mission: we're building a tool that improves how humans communicate with AI coding agents, and we're building it with those same agents.

## Tech Stack

- Chrome MV3 extension
- React 18 + TypeScript (sidepanel)
- TypeScript (content script, service worker)
- HTML5 Canvas API (annotations)
- Web Speech API (voice transcription)
- Vite (build)
- pnpm (package manager)

## License

MIT — see [LICENSE](LICENSE).
