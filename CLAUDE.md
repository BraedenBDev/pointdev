# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PointDev is an open source Chrome extension (MV3) that captures structured browser context — element selection, voice narration, canvas annotations, cursor behavior — and compiles it into structured prompts for AI coding agents. Built with React 18 + TypeScript, Vite, bun.

## Commands

```bash
bun install          # Install dependencies
bun dev              # Start Vite in watch mode (load dist/ as unpacked extension)
bun build            # Production build
bun run test         # Run Vitest unit tests (NOT `bun test` — that invokes Bun's runner)
bun run test:watch   # Vitest watch mode
bun lint             # ESLint + Prettier check
```

Extension testing is manual: load unpacked from `dist/` in `chrome://extensions/` (Developer Mode).

## Architecture

Four cooperating MV3 contexts:

- **Sidepanel** (`src/sidepanel/`) — React UI. Capture controls, live feedback, compiled output, copy-to-clipboard. Runs Web Speech API for voice transcription.
- **Service Worker** (`src/background/`) — State coordinator. Holds `CaptureSession`, routes messages between sidepanel and content script. Kept alive via port connection during capture, backed by `chrome.storage.session`.
- **Content Script** (`src/content/`) — Injected into active tab. Element selector, canvas annotation overlay (position: fixed), cursor tracker, React fiber inspector.
- **Shared** (`src/shared/`) — Types (`types.ts`), message definitions (`messages.ts`), template formatter (`formatter.ts`).

Message flow: Sidepanel ↔ Service Worker ↔ Content Script (via `chrome.runtime` messaging + port connection).

## Key Technical Details

- Canvas overlay uses `position: fixed` (viewport-sized), coordinates converted to page-relative on mouse release
- Web Speech API runs in sidepanel context — high-risk assumption, validated early. Fallback: offscreen document.
- React component detection is opportunistic (reads `__reactFiber$` from DOM nodes). Graceful fallback to CSS selector.
- Service worker can terminate in MV3. Long-lived port from sidepanel prevents this. Recovery via `chrome.storage.session`.
- Content script injection guarded by PING/PONG to prevent duplicates.
- CSS selectors generated via `css-selector-generator` package.

## Commit Conventions

- All AI-assisted commits MUST include: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Write clear commit messages describing *why*, not just *what*
- One logical change per commit

## GenAI Development Log — MANDATORY

**This project maintains an AI-assisted development log at `docs/genai-disclosure/development-log.md` for NLnet GenAI policy compliance.**

### When to update the log

Append a new session entry to the development log when ANY of the following occur:

1. **A task is marked completed** that involved AI-generated code, design, or documentation
2. **A significant design decision** is made during the session
3. **A milestone or feature is completed** (e.g., "element selector working", "canvas overlay implemented")
4. **A session ends** where meaningful work was done

### What to include in each entry

```markdown
## Session N — YYYY-MM-DD: [Brief title]

**Model:** [model name and version]
**Human lead:** Braeden Bihag
**AI role:** [what the AI did this session]

### What happened
[Numbered list of what was done]

### Decisions and rationale
[Table: Decision | Made by | Rationale]

### What was AI-generated vs. human-authored
[Bullet points clarifying authorship]

### Artifacts produced
[Table: Artifact | Path | Status]
```

### Rules

- Never skip the log update. It is a project deliverable, not optional documentation.
- Be honest about what the AI generated vs. what the human directed.
- Include failed approaches and pivots — not just successes.
- Record decisions the human made that overrode AI suggestions.
- Convert relative dates to absolute dates (e.g., "yesterday" → "2026-03-14").
- Keep entries factual and concise. This is a transparency log, not a narrative.

## Testing

- Unit tests: Vitest (`bun test`)
- Extension integration: manual (load unpacked, test on various pages)
- TDD workflow: write tests first, then implement

## Permissions (minimal)

`activeTab`, `scripting`, `sidePanel`, `storage` — no `debugger`, `tabs`, or host permissions.
