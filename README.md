# PointDev

Open source structured browser context capture for AI-assisted development.

PointDev is a Chrome extension that captures what you see in the browser and compiles it into a structured prompt that AI coding agents can act on. Click an element, speak about what you want changed, draw a circle around it. PointDev captures all of that with full technical context.

## The Problem

You spot a bug in your browser. You switch to Claude Code and type "the font on the hero section is too small." Your AI agent has to guess which file, which component, what the current font size is, and what "too small" means.

The DOM path, component name, computed styles, and your spatial intent are all lost. Every AI coding tool suffers from this input problem.

Browser automation tools (Playwright, Puppeteer, Claude's computer use) solve the inverse: they give AI agents the ability to see and navigate pages programmatically. But an agent that can read every DOM node on your page still doesn't know that *you* think the hero font is too small, that *you* were pointing at the H1 when you said it, or that *you* circled it for emphasis. Intent is not on the page. Intent is in the human's head, and it needs a way out that carries technical precision with it.

## What PointDev Does

PointDev captures technical context and human context at the same time.

**Technical context (captured automatically):**

| What | How |
|------|-----|
| CSS selector + DOM subtree | Click any element |
| Computed styles | font-size, color, spacing, etc. |
| React component name | Detected via fiber internals when available |
| Page metadata | URL, title, viewport dimensions |
| Device metadata | Browser, OS, screen size, pixel ratio |
| Cursor dwell behavior | Tracks what you point at while talking |
| Element screenshot | Captured on element selection |

**Human context (your input):**

| What | How |
|------|-----|
| Voice narration | Speak naturally about what you want changed |
| Visual annotations | Draw circles and arrows on the page |
| Element selection | Click the specific element you mean |

Everything compiles into a single structured prompt with timestamps that correlate your words with your annotations. Copy it, paste it into any AI coding tool, and the agent knows exactly what to do.

### Real Output

This is actual output from PointDev running on https://almostalab.io/:

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
[00:16] "to be"
[00:19] "two or three lines at Max"
[00:23] "and there is a problem at the bottom here"
[00:26] "where you scroll CTA"
[00:28] "is"
[00:32] "overlapping with the"
[00:35] "subtitle of the page"
[00:39] "here I'll select it"

## Annotations
1. [00:40] Circle around .lg\:min-h-\[100svh\] at (42, 1019), radius 131px

## Cursor Behavior
- [00:07-00:32] Dwelled 25.5s over h1.font-display.text-hero (during: "main hero")
- [00:21-00:29] Dwelled 7.2s over span.font-mono.text-[10px] (during: "and there is a problem at the bottom here")
- [00:25-00:32] Dwelled 7.3s over div.absolute.bottom-10 (during: "where you scroll CTA")
- [00:28-00:34] Dwelled 5.6s over p.hidden.lg:block (during: "is")
- [00:29-00:36] Dwelled 6.2s over div.absolute.bottom-10 (during: "overlapping with the")
```

An AI agent reading this output knows: the user wants the hero text smaller (two or three lines max), and there's an overlap between the scroll CTA (`div.absolute.bottom-10`) and the subtitle (`p.hidden.lg:block`). The cursor dwell data confirms which elements the user was looking at while speaking. No guesswork.

## Installation

> **Status: Proof of Concept.** Working demo, not a production release.

1. Clone this repository
2. `bun install && bun build`
3. Open `chrome://extensions/`, enable Developer Mode
4. Click "Load unpacked" and select the `dist/` folder
5. Open any web page, click the PointDev icon to open the sidepanel
6. On first open, a tab will ask for microphone permission (one-time setup for voice)

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

**Sidepanel (React):** Capture controls, live feedback, compiled output display. Coordinates voice transcription with the mic-permission tab.

**Service Worker:** Coordinates state between sidepanel and content script. Holds the capture session, routes messages, captures element screenshots.

**Content Script:** Injected into the active page for element selection, canvas annotation overlay (position: fixed, redraws on scroll), cursor tracking, and React component detection.

**Mic-Permission Tab:** Runs Web Speech API in a visible extension page. Chrome sidepanels and offscreen documents cannot get microphone access, so speech recognition runs here and sends results back to the sidepanel via messaging.

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
| `storage` | Persist capture session and mic permission state |
| `offscreen` | Reserved for future local transcription support |

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
