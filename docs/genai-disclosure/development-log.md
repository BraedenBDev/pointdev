# PointDev — AI-Assisted Development Log

> This document logs AI-assisted development sessions for transparency per NLnet's GenAI policy. Each entry records what was discussed, what was decided, what was generated, and who made which decisions.

---

## Session 1 — 2026-03-15: Project Initialization & MVP Design

**Model:** Claude Opus 4.6 (Anthropic, via Claude Code CLI)
**Duration:** ~1 hour
**Human lead:** Braeden Bihag (CTO, Almost a Lab S.L.)
**AI role:** Collaborative design partner, spec writer, document drafter

### What happened

1. **Context intake.** Braeden provided the full NLnet NGI Zero Commons Fund application document (`pointdev-nlnet-merged-v3.md`) describing PointDev — an open source Chrome extension + prompt-compiler library for structured browser context capture. The AI read and analyzed the 300-line application covering architecture, milestones, budget, competitive landscape, and technical challenges.

2. **MVP scoping.** Through a series of one-at-a-time questions, the scope was narrowed:
   - **MVP purpose:** Pre-submission demo for NLnet reviewers (not full M1 scope) — deadline April 1, 2026 (17 days)
   - **Demo scenario:** Simultaneous voice narration + canvas annotation over any webpage, compiled into structured output in the sidepanel with copy-to-clipboard
   - **Output format:** Structured plain text via template formatter (not the real pluggable compiler — that's future work)
   - **Annotation tools:** Circle + arrow only
   - **Voice:** Web Speech API only (no Whisper)
   - **React detection:** Opportunistic component name resolution, graceful fallback on non-React pages
   - **Cursor tracking:** Dwell detection as secondary intent signal (Braeden's addition to the design)
   - **Architecture approach:** Extension-first (single Chrome extension), not library-first or video mockup

3. **Design decisions made by Braeden:**
   - MVP should be application-blind and milestone-blind — it's a proof of concept that inspired the application, not a homework assignment for it
   - Limitations should be framed as "what we'd like to address with further development," not milestone references
   - Cursor dwell tracking should be included as a secondary signal (AI had not proposed this — Braeden identified it as important for capturing implicit pointing behavior)
   - Simultaneous capture (voice + annotation at the same time) rather than sequential — highest complexity but best demo impact

4. **Design presentation.** The AI presented the design in 7 sections, each approved by Braeden:
   - Extension architecture (MV3, 4 contexts)
   - Capture flow & state model (CaptureSession interface, interaction sequence)
   - Canvas annotation overlay (fixed-position canvas, coordinate system, element proximity mapping)
   - Voice recording & transcription (Web Speech API, timestamped segments)
   - React component detection (fiber inspection, fallback chain)
   - Template formatter (output format, conditional sections, computed style filtering)
   - Sidepanel UI (capture mode, output mode, error states)

5. **Document generation.** The AI drafted three documents:
   - **Design spec** (`docs/superpowers/specs/2026-03-15-pointdev-mvp-design.md`) — ~550 lines covering all design sections plus message passing, tech stack, and file structure
   - **README draft** (`docs/README-draft.md`) — GitHub-facing README with problem statement, feature description, example output, installation, usage, permissions, limitations, GenAI disclosure
   - **CONTRIBUTING draft** (`docs/CONTRIBUTING-draft.md`) — Dev setup, project structure, contribution areas, commit conventions

6. **Spec review.** An automated code reviewer identified 4 critical, 7 important, and 9 minor issues across the three documents. Key issues found and fixed:
   - Web Speech API may not work in sidepanel context — added microphone permission handling with fallback options (offscreen document, content script)
   - Missing `TRANSCRIPT_UPDATE` message type — sidepanel had no way to send voice data to service worker
   - `CURSOR_BATCH` vs `CURSOR_SAMPLE` inconsistency in message types
   - Tab lifecycle during capture not addressed (tab switching, screenshot timing)
   - Canvas sizing strategy unspecified (fixed: `position: fixed`, viewport-sized)
   - Service worker lifecycle risk (can terminate) — fixed with port connection + `chrome.storage.session` backup with recovery protocol
   - Computed styles shorthand issue (`padding`/`margin` not returned by `getComputedStyle`)
   - DOM subtree truncation algorithm unspecified
   - Content script duplicate injection — added PING/PONG guard
   - README listed Web Speech API as a separate "context" (it's a browser API, not an extension context)

   All issues were fixed and verified in a second review pass. Four minor new issues (type clarity) were also resolved.

### Decisions and rationale

| Decision | Made by | Rationale |
|---|---|---|
| MVP = pre-submission demo, not full M1 | Braeden | Stronger NLnet application with working code |
| Simultaneous capture (voice + draw) | Braeden | Most natural UX, strongest differentiator |
| Cursor dwell tracking included | Braeden | Captures implicit pointing behavior even without deliberate annotation |
| Circle + arrow only (no freehand) | Braeden | Covers 90% of pointing use cases, minimizes canvas work |
| Web Speech API only (no Whisper) | Braeden | Zero-config for demo, no API keys needed |
| Extension-first approach (not library-first) | AI recommendation, Braeden approved | One thing to build and demo in 17 days; library separation is future work |
| Template formatter, not pluggable compiler | AI recommendation, Braeden approved | Proves the pipeline without building the full M4 architecture |
| MVP is milestone-blind | Braeden | Demo should stand alone as a proof of concept, not reference grant milestones |

### What was AI-generated vs. human-authored

- **AI-generated:** Design spec document, README draft, CONTRIBUTING draft, CaptureSession interface, message type definitions, file structure, all prose in the three documents
- **Human-directed:** All scoping decisions (MVP purpose, capture scenario, tool selection, architecture approach), cursor dwell tracking concept, milestone-blind framing, the specific demo scenario ("and here, the font is far too small, lets increase 25%" + circle on H1)
- **AI-identified, human-approved:** Extension-first approach, template formatter instead of real compiler, Web Speech API sidepanel risk and fallback plan, service worker lifecycle handling

### Artifacts produced

| Artifact | Path | Status |
|---|---|---|
| Design specification | `docs/superpowers/specs/2026-03-15-pointdev-mvp-design.md` | Complete, reviewed, issues fixed |
| README draft | `docs/README-draft.md` | Complete, consistent with spec |
| CONTRIBUTING draft | `docs/CONTRIBUTING-draft.md` | Complete, consistent with spec |
| Development log | `docs/genai-disclosure/development-log.md` | This document |

### Next steps

- ~~Braeden to review the written spec~~ Done
- ~~Write implementation plan~~ Done
- Begin implementation with Web Speech API sidepanel spike (highest-risk validation)

---

## Session 2 — 2026-03-15: Implementation Plan & Sprint Start

**Model:** Claude Opus 4.6 (Anthropic, via Claude Code CLI)
**Duration:** ~30 minutes
**Human lead:** Braeden Bihag
**AI role:** Implementation planner, sprint orchestrator

### What happened

1. **Spec approved.** Braeden reviewed and approved the design specification without changes.

2. **Implementation plan written.** The AI produced a detailed TDD implementation plan (`docs/superpowers/plans/2026-03-15-pointdev-mvp.md`) with 15 tasks across 4 chunks:
   - Chunk 1: Project scaffold, shared types, Web Speech API spike
   - Chunk 2: Service worker state management, template formatter, message routing
   - Chunk 3: Content script — element selector, canvas overlay, cursor tracker, React inspector, coordinator
   - Chunk 4: Sidepanel UI, output view, copy-to-clipboard, README/LICENSE

   Each task follows strict TDD: write failing test → implement → verify → commit. Complete code provided for every file.

3. **Plan reviewed by automated reviewer.** Submitted to code reviewer subagent for validation against the spec.

4. **Implementation workflow established.** Braeden directed:
   - Use a feature branch/worktree for implementation
   - Dispatch independent tasks as parallel backgrounded subagents
   - After each sprint/chunk completion, launch parallel code reviewer + code simplifier agents to review recent commits
   - Self-orchestrated review loop

5. **GenAI disclosure log updated** (this entry).

### Decisions and rationale

| Decision | Made by | Rationale |
|---|---|---|
| Approve spec without changes | Braeden | Satisfied with design after two review iterations |
| Use parallel subagents for implementation | Braeden | Maximize throughput on 17-day timeline |
| Post-sprint code review + simplification | Braeden | Catch quality issues early without blocking implementation |
| Feature branch/worktree isolation | Braeden | Clean separation of implementation work from main |

### What was AI-generated vs. human-authored

- **AI-generated:** Full implementation plan with 15 tasks, all test code, all implementation code, all build configuration
- **Human-directed:** Sprint workflow (parallel agents, post-sprint review), branch strategy, decision to proceed without spec changes

### Artifacts produced

| Artifact | Path | Status |
|---|---|---|
| Implementation plan | `docs/superpowers/plans/2026-03-15-pointdev-mvp.md` | Complete, under review |
| CLAUDE.md | `CLAUDE.md` | Complete |
| Workflow preferences | Memory: `feedback_workflow.md` | Saved |

### Next steps

- ~~Initialize git repo and feature branch~~ Done
- Execute Chunk 1 (scaffold, types, Speech API spike) via parallel subagents
- Sprint review after Chunk 1 completion

---

## Session 3 — 2026-03-15: Task 1 — Project Scaffold & MV3 Build

**Model:** Claude Opus 4.6 (Anthropic, via Claude Code CLI)
**Human lead:** Braeden Bihag
**AI role:** Implementation agent (executing Task 1 from implementation plan)

### What happened

1. **Initialized bun project.** Ran `bun init` in the project root.

2. **Installed all dependencies.** React 19, React DOM 19 as production deps. TypeScript, Vite 8, @crxjs/vite-plugin 2.3.0, @vitejs/plugin-react, Vitest, @testing-library/react, @testing-library/jest-dom, jsdom, @types/chrome, @types/react, @types/react-dom, css-selector-generator, eslint, prettier as dev deps.

3. **CRXJS version resolution.** The plan specified `@crxjs/vite-plugin@beta` (2.0.0-beta.27), which was unavailable. Beta.33 was deprecated. Used stable 2.3.0, which works correctly with Vite 8.

4. **Created project scaffold.** All files from Task 1:
   - `tsconfig.json` — strict TypeScript with `@shared/*` path alias
   - `vite.config.ts` — Vite + React + CRXJS with path alias and Vitest config
   - `src/manifest.json` — MV3 manifest with sidePanel, activeTab, scripting, storage permissions
   - `src/sidepanel/index.html`, `main.tsx`, `App.tsx` — minimal React sidepanel
   - `src/background/service-worker.ts` — opens sidepanel on action click
   - `src/content/index.ts` — PING/PONG message listener
   - `tests/setup.ts` — jest-dom setup for Vitest
   - `public/icons/icon{16,48,128}.png` — solid teal placeholder icons (generated via Node.js)
   - `.gitignore` — excludes node_modules/, dist/, logs, .DS_Store

5. **Added package.json scripts.** dev, build, test, test:watch, lint.

6. **Verified build.** `bun build` succeeds, producing dist/ with correct manifest.json, service worker loader, sidepanel HTML, bundled assets, and icons.

### Decisions and rationale

| Decision | Made by | Rationale |
|---|---|---|
| Use @crxjs/vite-plugin 2.3.0 (stable) instead of beta | AI (pragmatic) | Beta.27 unavailable, beta.33 deprecated, stable 2.3.0 works with Vite 8 |
| Add .gitignore | AI (standard practice) | Prevent node_modules/ and dist/ from being committed |
| Generate icons via Node.js zlib | AI (tooling constraint) | ImageMagick not available on system |

### What was AI-generated vs. human-authored

- **AI-generated:** All scaffold files (tsconfig.json, vite.config.ts, manifest.json, sidepanel files, service worker, content script, test setup, icons, .gitignore, package.json scripts)
- **Human-directed:** File contents and structure specified in implementation plan (written in Session 2)

### Artifacts produced

| Artifact | Path | Status |
|---|---|---|
| Package configuration | `package.json` | Complete |
| TypeScript config | `tsconfig.json` | Complete |
| Vite + CRXJS config | `vite.config.ts` | Complete |
| MV3 manifest | `src/manifest.json` | Complete |
| Sidepanel entry | `src/sidepanel/index.html`, `main.tsx`, `App.tsx` | Complete |
| Service worker | `src/background/service-worker.ts` | Complete |
| Content script | `src/content/index.ts` | Complete |
| Test setup | `tests/setup.ts` | Complete |
| Placeholder icons | `public/icons/icon{16,48,128}.png` | Complete |
| Git ignore | `.gitignore` | Complete |

### Next steps

- Execute Task 2 (shared types and message definitions)
- Execute Task 3 (Web Speech API spike)
- Continue with remaining Chunk 1 tasks
