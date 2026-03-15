# PointDev

Open source structured browser context capture for AI-assisted development.

PointDev is a Chrome extension that captures what you see in the browser and compiles it into a structured prompt that AI coding agents can act on. Click an element, speak about what you want changed, draw a circle around it. PointDev captures all of that with full technical context.

## The Problem

You spot a bug in your browser. You switch to Claude Code and type "the font on the hero section is too small." Your AI agent has to guess which file, which component, what the current font size is, and what "too small" means.

The DOM path, component name, computed styles, and your spatial intent are all lost. Every AI coding tool suffers from this input problem.

## What PointDev Does

PointDev captures technical context and human context at the same time.

**Technical context (captured automatically):**

| What | How |
|------|-----|
| CSS selector + DOM subtree | Click any element |
| Computed styles | font-size, color, spacing, etc. |
| React component name | Detected via fiber internals when available |
| Page metadata | URL, title, viewport dimensions |
| Cursor dwell behavior | Tracks what you point at while talking |

**Human context (your input):**

| What | How |
|------|-----|
| Voice narration | Speak naturally about what you want changed |
| Visual annotations | Draw circles and arrows on the page |
| Element selection | Click the specific element you mean |

Everything compiles into a single structured prompt with timestamps that correlate your words with your annotations. Copy it, paste it into any AI coding tool, and the agent knows exactly what to do.

### Example Output

```
## Context
- URL: https://myapp.dev/landing
- Page title: My App - Landing
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
- [00:22-00:25] Dwelled 3.1s over div.hero > h1 (during: "the font is far too small")

## Screenshot
[base64 data URL]
```

## Installation

> **Status: Proof of Concept.** Working demo, not a production release.

1. Clone this repository
2. `bun install && bun build`
3. Open `chrome://extensions/`, enable Developer Mode
4. Click "Load unpacked" and select the `dist/` folder
5. Open any web page, click the PointDev icon to open the sidepanel

## Usage

1. Click **Start Capture** in the sidepanel
2. Talk, draw, and click simultaneously:
   - **Click** any element to capture its DOM context
   - **Toggle to Circle or Arrow** mode to annotate the page
   - **Speak** to narrate what you want (transcription runs live)
3. Click **Stop Capture**
4. Review the compiled prompt in the sidepanel
5. Click **Copy to Clipboard** and paste into your AI coding tool

## How It Works

PointDev is a Chrome Manifest V3 extension with three cooperating contexts:

**Sidepanel (React):** Capture controls, live feedback, compiled output display, and voice transcription via Web Speech API.

**Service Worker:** Coordinates state between sidepanel and content script. Holds the capture session.

**Content Script:** Injected into the active page for element selection, canvas annotation overlay, cursor tracking, and React component detection.

All capture data flows into a single `CaptureSession` object with timestamps relative to recording start. A template formatter compiles this into the structured output.

### React Component Detection

When you click an element on a React page, PointDev inspects React fiber internals (`__reactFiber$`) to resolve the component name and source file. Works on development builds and most production builds. If React isn't detected, it falls back to CSS selector + DOM subtree. The extension works on any web page.

## Permissions

PointDev requests minimal Chrome permissions:

| Permission | Why |
|---|---|
| `activeTab` | Access the current tab when you start a capture |
| `scripting` | Inject the content script for element selection and annotation |
| `sidePanel` | The extension UI |
| `storage` | Persist your preferences |

No background access to your browsing. No data leaves your machine except Web Speech API audio, which Chrome sends to Google for transcription.

## Current Limitations

This is a proof of concept. Here's what we want to address next:

**Transcription privacy.** Web Speech API sends audio to Google. A local option (Whisper, on-device models) would keep everything on-machine.

**Annotation tools.** Currently circle and arrow only. Freehand, rectangles, and text labels would cover more use cases.

**Framework coverage.** React detection only. Vue and Svelte expose similar internals and could be supported with framework-specific adapters.

**Structured output formats.** Output is plain text. A pluggable compiler with JSON, Markdown, and MCP-compatible adapters would enable programmatic consumption.

**Console and network context.** Console errors and failed network requests are high-value debugging context. Requires `chrome.debugger` API with elevated permissions.

**Direct tool integration.** Output goes via clipboard. A local bridge server could deliver context directly to Claude Code, Aider, and other tools.

**Multi-element selection.** Currently captures one element per session. Multiple selections would support feedback like "these three buttons are inconsistent."

## AI-Assisted Development Disclosure

This project is built using AI coding tools (Claude Code, Cursor) as the primary implementation workflow. The developer architects solutions, defines acceptance criteria, and reviews all code. AI agents execute implementation tasks under human direction.

Commits from AI agents use `Co-Authored-By` tags so they are distinguishable from human-authored commits. All code is reviewed, tested, and validated by the maintainer before merging. Architectural decisions are made by the human lead.

This is directly relevant to PointDev's mission: we're building a tool that improves the input side of human-to-AI-coder communication, and we're building it with those same tools.

## Tech Stack

Chrome MV3 / React 18 / TypeScript / HTML5 Canvas API / Web Speech API / Vite / bun

## License

MIT. See [LICENSE](LICENSE).
