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
   - **Design spec** (`docs/design/mvp-design.md`) — ~550 lines covering all design sections plus message passing, tech stack, and file structure
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
| Design specification | `docs/design/mvp-design.md` | Complete, reviewed, issues fixed |
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

2. **Implementation plan written.** The AI produced a detailed TDD implementation plan (`docs/design/mvp-implementation-plan.md`) with 15 tasks across 4 chunks:
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
| Implementation plan | `docs/design/mvp-implementation-plan.md` | Complete, under review |
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

- ~~Execute Task 2 (shared types and message definitions)~~ Done
- ~~Execute Task 3 (Web Speech API spike)~~ Done
- ~~Continue with remaining Chunk 1 tasks~~ Done

---

## Session 4 — 2026-03-15: Full MVP Implementation Sprint (Tasks 1–15)

**Model:** Claude Opus 4.6 (Anthropic, via Claude Code CLI)
**Duration:** ~3 hours
**Human lead:** Braeden Bihag
**AI role:** Implementation agent, test author, build verifier

### What happened

1. **All 15 tasks from the implementation plan completed.** The full MVP was implemented in a single sprint session, covering all four chunks of the plan:
   - **Chunk 1 (Tasks 1–3):** Project scaffold with MV3 + Vite + CRXJS build, shared types and message definitions, Web Speech API spike with `useSpeechRecognition` hook
   - **Chunk 2 (Tasks 4–7):** SessionStore for capture state management, template formatter, service worker message routing, React fiber inspector
   - **Chunk 3 (Tasks 8–11):** Element selector with computed styles extraction, canvas annotation overlay (circle + arrow), cursor tracker with dwell detection, content script coordinator
   - **Chunk 4 (Tasks 12–15):** Sidepanel UI with capture controls, live feedback, output view, copy-to-clipboard, README/CONTRIBUTING/LICENSE

2. **Parallel execution with 6 subagents.** Chunks 2 and 3 were dispatched to 6 parallel subagents for concurrent implementation. Each subagent followed TDD: write failing tests, implement to pass, verify, commit.

3. **Key implementation decisions made during sprint:**
   - **No worktree isolation.** Git worktrees were attempted but failed due to environment constraints. Fell back to file-scoped parallelism — each subagent worked on independent files within the same working tree, avoiding conflicts.
   - **Incremental transcript sending.** The `useSpeechRecognition` hook sends transcript segments incrementally to the service worker via `TRANSCRIPT_UPDATE` messages, rather than batching at session end.
   - **`computeDwells` moved to shared.** Dwell computation logic was placed in `src/shared/dwell.ts` rather than in the content script, since both content script (cursor tracking) and service worker (session compilation) need access to dwell logic.
   - **CRXJS 2.3.0 (stable).** Used instead of the beta specified in the plan, as the beta was unavailable. Works correctly with Vite 8.

4. **Test suite: 62 tests across 10 test files.** All passing:
   - `tests/shared/types.test.ts` — type guard and validation tests
   - `tests/shared/dwell.test.ts` — dwell computation from cursor samples
   - `tests/shared/formatter.test.ts` — template formatter output verification
   - `tests/background/session-store.test.ts` — SessionStore state management
   - `tests/background/service-worker.test.ts` — message routing and session lifecycle
   - `tests/sidepanel/hooks/useSpeechRecognition.test.ts` — Web Speech API hook
   - `tests/content/element-selector.test.ts` — DOM inspection and style extraction
   - `tests/content/canvas-overlay.test.ts` — canvas annotation rendering
   - `tests/content/cursor-tracker.test.ts` — mousemove sampling and batching
   - `tests/content/react-inspector.test.ts` — React fiber component detection

5. **Build verified clean.** `bun build` produces a valid dist/ folder with manifest.json, service worker loader, sidepanel HTML, bundled assets, and icons. No TypeScript errors, no build warnings (aside from harmless CRXJS rollupOptions/rolldownOptions deprecation notices).

6. **Documentation finalized.** README.md copied from draft, CONTRIBUTING.md copied from draft, MIT LICENSE created with "2026 Almost a Lab S.L." copyright.

### Decisions and rationale

| Decision | Made by | Rationale |
|---|---|---|
| Fall back to file-scoped parallelism (no worktrees) | AI (pragmatic) | Worktree creation failed; file-scoped approach avoids merge conflicts since tasks target independent files |
| Incremental transcript sending | AI (design choice) | Matches real-time UX — sidepanel shows live transcript, service worker correlates with cursor/annotation timestamps |
| computeDwells in shared/ | AI (architecture) | Both content script and service worker need dwell logic; shared module avoids duplication |
| CRXJS 2.3.0 stable | AI (pragmatic) | Beta unavailable, stable release compatible with Vite 8 |
| 6 parallel subagents for Chunks 2–3 | Braeden (workflow) | Maximize throughput; independent file targets enable safe parallelism |

### What was AI-generated vs. human-authored

- **AI-generated:** All 20 source files, all 10 test files, all build configuration, LICENSE text, commit messages
- **Human-directed:** Implementation plan (Session 2), parallel execution strategy, sprint workflow, all architectural decisions from design spec (Session 1)
- **AI-decided (within human-defined constraints):** Worktree fallback strategy, dwell module placement, incremental transcript pattern, CRXJS version selection

### Artifacts produced

| Artifact | Path | Status |
|---|---|---|
| Shared types | `src/shared/types.ts`, `src/shared/messages.ts` | Complete |
| Dwell computation | `src/shared/dwell.ts` | Complete |
| Template formatter | `src/shared/formatter.ts` | Complete |
| Session store | `src/background/session-store.ts` | Complete |
| Message handler | `src/background/message-handler.ts` | Complete |
| Service worker | `src/background/service-worker.ts` | Complete |
| Element selector | `src/content/element-selector.ts` | Complete |
| Canvas overlay | `src/content/canvas-overlay.ts` | Complete |
| Cursor tracker | `src/content/cursor-tracker.ts` | Complete |
| React inspector | `src/content/react-inspector.ts` | Complete |
| Content coordinator | `src/content/index.ts` | Complete |
| Speech recognition hook | `src/sidepanel/hooks/useSpeechRecognition.ts` | Complete |
| Capture session hook | `src/sidepanel/hooks/useCaptureSession.ts` | Complete |
| Sidepanel components | `src/sidepanel/components/CaptureControls.tsx`, `LiveFeedback.tsx`, `OutputView.tsx`, `CopyButton.tsx` | Complete |
| Sidepanel app | `src/sidepanel/App.tsx` | Complete |
| Test suite (62 tests) | `tests/**/*.test.ts` (10 files) | All passing |
| README | `README.md` | Complete |
| CONTRIBUTING | `CONTRIBUTING.md` | Complete |
| MIT License | `LICENSE` | Complete |

### Next steps

- ~~Post-sprint code review~~ Done (Session 5)
- ~~Post-sprint code simplification~~ Done (Session 5)
- ~~Fix critical issues from review~~ Done (Session 5)
- Manual testing in Chrome (Web Speech API validation, full capture flow)

---

## Session 5 — 2026-03-15: Code Review, Fixes, Repo Creation & PR

**Model:** Claude Opus 4.6 (Anthropic, via Claude Code CLI)
**Duration:** ~45 minutes
**Human lead:** Braeden Bihag
**AI role:** Code reviewer, code simplifier, bug fixer, repo setup

### What happened

1. **Parallel code review and simplification.** Two agents ran simultaneously after the implementation sprint:

   **Code reviewer** found 3 critical, 8 important, and 6 minor issues:
   - C1: Content script not bundled in build output (manifest.json missing `content_scripts` entry)
   - C2: OutputView produced duplicate cursor trace data (filter-and-concat logic was wrong)
   - C3: Screenshot taken before canvas overlay removal confirmed (fragile 50ms setTimeout)
   - I7: SpeechRecognition `onresult` re-processed all previous results on every event, creating duplicate segments
   - I9: Dark mode error message background hardcoded to light pink
   - Other issues noted as acceptable for PoC (shallow copies in SessionStore, no HiDPI canvas scaling, approximate voice timestamps, no 500ms PING timeout)

   **Code simplifier** made 7 targeted improvements across src/:
   - Replaced `(this as any)` casts in CursorTracker with properly typed private fields
   - Consolidated duplicated stroke style assignments in CanvasOverlay into `applyStrokeStyle` method
   - Removed dead `detectVue` export from react-inspector (never called)
   - Extracted `reconstructShorthand` helper in formatter to eliminate duplicated padding/margin logic
   - Fixed the same OutputView dwell duplication bug independently
   - Simplified CopyButton by deduplicating the setCopied logic
   - Net result: -24 lines

2. **Critical fixes applied.** Four issues fixed in a single commit:
   - Added `content_scripts` entry to manifest.json so CRXJS bundles the content script
   - Fixed SpeechRecognition `onresult` to track processed result index (`processedResultsRef`), preventing duplicate segment creation
   - Removed fragile 50ms screenshot delay, relying on `REMOVE_CAPTURE` message response confirmation
   - Fixed dark mode error background using `color-mix(in srgb, var(--danger) 10%, var(--bg))`

3. **README rewrite.** Braeden requested a clearer, more concise README. The rewrite improved readability and structure:
   - Replaced repetitive bullet-dash patterns with tables in "What PointDev Does" section
   - Limitations section uses bold headings + sentences for scannability
   - Disclosure section uses prose paragraphs instead of bullet lists
   - Tech stack collapsed to a single line
   - Tightened language throughout

4. **GitHub repository created.** Public repo at `github.com/BraedenBDev/pointdev` (to be transferred to `AlmostaLab` org when permissions allow). Main branch pushed with full commit history.

5. **First pull request created.** PR #1 (`feat/mvp-implementation`) merged to main via GitHub, containing all 16 implementation commits.

### Decisions and rationale

| Decision | Made by | Rationale |
|---|---|---|
| Fix critical issues before PR | AI (quality gate) | Content script not bundling is a showstopper; SpeechRecognition duplicates corrupt output |
| Accept PoC-level issues (shallow copies, no HiDPI, approximate timestamps) | Braeden (implicit) | These don't affect the demo; real fixes belong in post-funding milestones |
| Rewrite README for clarity | Braeden | README is the first thing reviewers see; it should be concise and scannable |
| Create repo under BraedenBDev (not AlmostaLab) | Braeden | GitHub auth didn't have org permissions; repo can be transferred later |
| Commit README rewrite directly to main | Braeden | Not a code change, no review needed |

### What was AI-generated vs. human-authored

- **AI-generated:** Code review report, all code fixes, code simplification refactors, README rewrite, PR description, commit messages
- **Human-directed:** Decision to rewrite README for clarity, decision to create repo under personal account, decision to commit directly to main
- **AI-identified, human-approved (implicit):** Which review issues to fix vs. accept for PoC, content_scripts manifest fix approach

### Artifacts produced

| Artifact | Path | Status |
|---|---|---|
| Code review fixes | `src/manifest.json`, `src/sidepanel/hooks/useSpeechRecognition.ts`, `src/background/message-handler.ts`, `src/sidepanel/styles.css` | Committed |
| Code simplification | 7 files across `src/` | Committed |
| README rewrite | `README.md` | Committed to main |
| GitHub repository | `github.com/BraedenBDev/pointdev` | Public, live |
| Pull request #1 | `github.com/BraedenBDev/pointdev/pull/1` | Merged |

---

## MVP Summary

**Total development time:** ~5 hours across 5 sessions on 2026-03-15

**What was built:** A Chrome MV3 extension (proof of concept) that captures structured browser context through simultaneous voice narration, canvas annotation, element selection, and cursor tracking, then compiles it into a structured prompt for AI coding agents.

**Commit history:** 18 commits on `feat/mvp-implementation`, merged to `main` via PR #1, plus 1 post-merge README commit.

**Test coverage:** 62 unit tests across 10 test files. All passing.

**Code authorship breakdown:**
- ~95% of source code was AI-generated (Claude Opus 4.6 via Claude Code CLI subagents)
- 100% of architectural decisions, scoping, and product direction by Braeden Bihag
- All code reviewed by automated code reviewer + code simplifier agents, with critical issues fixed before merge
- All AI-generated commits tagged with `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

**Development methodology:** TDD with AI subagents. Human lead defined acceptance criteria and architecture in a design spec. Implementation plan decomposed the spec into 15 tasks. Up to 6 AI subagents executed tasks in parallel, each following write-test-implement-verify-commit. Post-sprint review by separate code reviewer and code simplifier agents.

**What remains for manual validation:**
- Load unpacked extension in Chrome and test full capture flow
- Confirm Web Speech API works in sidepanel context (highest-risk assumption)
- Test React component detection on a dev-mode React page
- Test on non-React pages for graceful fallback

**Repository:** https://github.com/BraedenBDev/pointdev (public, MIT license)

---

## Session 6 — 2026-03-15: Post-MVP Feature PRs & E2E Debugging

**Model:** Claude Opus 4.6 (Anthropic, via Claude Code CLI)
**Duration:** ~2 hours
**Human lead:** Braeden Bihag
**AI role:** Feature developer, systematic debugger

### What happened

1. **Package manager migration.** Braeden requested switch from pnpm to bun. History was surgically rewritten so pnpm never appeared in any commit (using git-filter-repo for blob-level replacement + rebase to swap lockfiles). All 82 tests pass under bun.

2. **Three feature PRs created:**
   - **PR #2** (device metadata): captures browser name/version, OS, screen resolution, window dimensions, device pixel ratio, touch support, color scheme. 10 new tests.
   - **PR #3** (element screenshots): replaces full-viewport base64 screenshot dump with element-scoped screenshots captured on element selection. Output references screenshots by selector and dimensions, not inline base64.
   - **PR #4** (cursor dwell noise): raises dwell threshold from 500ms to 1s, collapses consecutive dwells on the same element into a single entry. Fixes noisy output that showed 10 entries for scrolling past one heading.

3. **Positioning documentation.** Braeden asked how to position PointDev relative to browser automation tools (Playwright, Claude's computer use). Added positioning to README and design spec: browser automation gives AI agents eyes, PointDev gives humans a voice. They're complementary layers solving opposite directions of communication.

4. **PR history cleanup.** PR #1 body was rewritten to read like architectural decisions (not a task execution report). Removed references to "15 tasks across 4 chunks" and NLnet application. One commit message had a "(Step 5)" plan reference removed via rebase.

5. **Manual E2E testing and systematic debugging.** Braeden loaded the extension in Chrome and tested. Issues found and investigated:

   **Issue: "No active tab found"** — `chrome.tabs.query` with `activeTab` permission doesn't populate the `url` field. Root cause traced through three iterations:
   - First fix: changed `currentWindow: true` to `lastFocusedWindow: true` (didn't help)
   - Second fix: used `chrome.tabs.get(tabId)` for URL (still undefined from service worker)
   - Final fix: get URL from content script's `sendResponse` to `INJECT_CAPTURE` (content script has `window.location`)

   **Issue: Microphone never prompts.** Traced through two iterations:
   - First fix: moved Speech Recognition to offscreen document with `USER_MEDIA` reason (CSP blocked inline script)
   - Second fix: moved script to separate `.js` file (loaded but `SpeechRecognition.start()` still got `not-allowed`)
   - Third fix: added `getUserMedia({ audio: true })` call before `SpeechRecognition.start()` to explicitly trigger Chrome's permission dialog (deployed but untested — user didn't reload)

   **Issue: Canvas annotations don't scroll with the page.** Root cause identified: `CanvasOverlay` uses `position: fixed` and stores viewport coordinates in `drawnAnnotations`. No scroll listener triggers redraw. Annotations stay stuck to viewport position when user scrolls. Fix planned but not implemented (see `docs/design/pending-fixes.md`).

   **Issue: "message channel closed" console errors.** Root cause: `chrome.runtime.sendMessage` broadcasts to all contexts, and listeners return `true` (async) for messages they don't handle. Fix planned.

### Decisions and rationale

| Decision | Made by | Rationale |
|---|---|---|
| Switch to bun, rewrite history | Braeden | Preferred tooling; clean history |
| Element-scoped screenshots instead of viewport dump | Braeden | Base64 walls are useless in output; context-aware captures are more valuable |
| Cursor dwell threshold 500ms → 1000ms | AI recommendation, Braeden approved | 500ms too sensitive, produced noisy output |
| Canvas scroll fix deferred to next PR | Braeden | Needs careful implementation, don't rush it |
| Position PointDev as complementary to browser automation | Braeden | Reviewers might think Playwright solves the same problem |
| Get page URL from content script, not tabs API | AI (debugging) | activeTab permission doesn't expose URL to service worker |

### What was AI-generated vs. human-authored

- **AI-generated:** Device metadata collector, element screenshot rework, cursor dwell dedup, offscreen speech document, all debugging fixes, positioning copy, PR descriptions
- **Human-directed:** bun preference, screenshot rework concept (base64 is useless), dwell noise identification (from real output), positioning question (Playwright/Claude comparison), canvas scroll bug report, decision to defer canvas fix
- **Human-identified bugs (from manual testing):** all four issues above were found by Braeden testing the extension, not by automated tests or AI review

### Artifacts produced

| Artifact | Path | Status |
|---|---|---|
| Device metadata collector | `src/content/device-metadata.ts` | Merged (PR #2) |
| Element screenshot rework | Multiple files | Merged (PR #3) |
| Cursor dwell dedup | `src/shared/dwell.ts` | Merged (PR #4) |
| Offscreen speech document | `public/offscreen.html`, `public/offscreen.js` | On main, untested |
| Tab URL fix | `src/background/message-handler.ts`, `src/content/index.ts` | On main |
| Pending fixes plan | `docs/design/pending-fixes.md` | Written |
| Browser automation positioning | `README.md`, design spec | On main |

### Next steps

- Fix canvas annotation scroll anchoring (highest priority)
- Fix message channel broadcast noise
- Verify microphone permission flow (getUserMedia + offscreen)

---

## Session 7 — 2026-03-15: Canvas Scroll Fix & Message Channel Cleanup

**Model:** Claude Opus 4.6 (Anthropic, via Claude Code CLI)
**Human lead:** Braeden Bihag
**AI role:** Bug fixer, test author

### What happened

1. **Canvas annotation scroll anchoring fixed.** Implemented the plan from `docs/design/pending-fixes.md`. Three changes to `src/content/canvas-overlay.ts`: (a) store page-relative coordinates in `drawnAnnotations` by adding `scrollX/Y` at draw time, (b) subtract current `scrollX/Y` in `redraw()` to convert back to viewport-relative for rendering, (c) add a `requestAnimationFrame`-throttled scroll listener that calls `redraw()` on every scroll event, cleaned up in `destroy()`.

2. **Message channel noise eliminated.** Updated three files to only return `true` from `onMessage` for message types that listener actually handles:
   - `src/background/service-worker.ts` — added `HANDLED_TYPES` set, returns `false` for unknown types
   - `src/content/index.ts` — added `CONTENT_HANDLED` set, returns `false` for all cases (synchronous responses)
   - `src/sidepanel/hooks/useCaptureSession.ts` — returns `false` for unhandled message types

3. **Tests updated.** Added two new test cases to `tests/content/canvas-overlay.test.ts`: verifying page-relative coordinate storage with viewport-relative drawing, and scroll listener registration/cleanup lifecycle. Extracted `createMockWindow` helper.

4. **PR #5 created.** Both fixes bundled into one PR since they were both from the same pending-fixes plan.

### Decisions and rationale

| Decision | Made by | Rationale |
|---|---|---|
| Bundle both fixes in one PR | AI | Both were in the same plan doc and both are small, focused fixes |
| Use rAF throttle for scroll listener | AI (from plan) | Prevents jank from high-frequency scroll events |
| Content script returns false (sync) | AI | All content script message handlers call sendResponse inline, no async needed |

### What was AI-generated vs. human-authored

- **AI-generated:** All code changes, test updates, PR description
- **Human-directed:** Priority order (canvas first), decision to proceed from previous session's plan

### Artifacts produced

| Artifact | Path | Status |
|---|---|---|
| Canvas scroll fix | `src/content/canvas-overlay.ts` | PR #5, merged |
| Message channel cleanup | 3 files (service-worker, content, useCaptureSession) | PR #5, merged |
| Updated canvas tests | `tests/content/canvas-overlay.test.ts` | PR #5, merged |

---

## Session 8 — 2026-03-15: Microphone Permission Flow & First Full Capture

**Model:** Claude Opus 4.6 (Anthropic, via Claude Code CLI)
**Human lead:** Braeden Bihag
**AI role:** Researcher, architect, implementer

### What happened

1. **Microphone permission root cause identified.** Research (via Tavily) confirmed that Chrome offscreen documents and sidepanels cannot present the browser's microphone permission prompt. `getUserMedia` in offscreen fails silently with `NotAllowedError: Permission dismissed`. This is a known Chrome limitation, not a code bug.

2. **Three iterations to get mic working:**
   - **Attempt 1 (PR #6):** Open `mic-permission.html` mid-capture to grant permission, then start offscreen SpeechRecognition. Failed because opening the tab disrupted the active capture session (sidepanel port disconnected).
   - **Attempt 2:** Check permission before capture, show "Setup Microphone" button in idle state. Failed because `navigator.permissions.query` returns unreliable results in sidepanel context, and the offscreen document still couldn't use mic even after the visible page granted it.
   - **Attempt 3 (final):** Abandoned offscreen document entirely. Moved SpeechRecognition into `mic-permission.html` itself, which stays open as a background tab during capture. The sidepanel sends `SPEECH_START`/`SPEECH_STOP` messages to it. On first sidepanel open, the tab auto-opens if no stored grant flag exists.

3. **First successful full capture achieved.** Voice transcription, canvas annotations, cursor tracking, and element selection all working together. Capture output includes timestamped voice segments correlated with cursor dwell data and annotations.

### Decisions and rationale

| Decision | Made by | Rationale |
|---|---|---|
| Abandon offscreen for speech | AI (after research + 2 failed attempts) | Offscreen getUserMedia is fundamentally unreliable in Chrome extensions |
| Run SpeechRecognition in visible tab | AI | Research confirmed visible extension pages reliably get mic permission |
| Auto-open mic tab on sidepanel mount | Braeden | Users shouldn't have to discover a setup button |
| Keep mic tab open during capture | AI | SpeechRecognition needs a DOM context that persists through the capture |
| Store grant flag in chrome.storage.local | AI | Prevents re-opening the mic tab on every sidepanel open |

### What was AI-generated vs. human-authored

- **AI-generated:** All three mic permission implementations, research query, mic-permission.html/js rewrite, useSpeechRecognition rewrite, test updates
- **Human-directed:** "create an explicit on-sidepanel open" (prompted the auto-open approach), "no popup, no change in behavior" (identified stale storage flag issue), decision to keep iterating until mic worked
- **Human-identified bugs:** mic permission tab not appearing (stale flag), capture disruption when tab opened mid-session

### Artifacts produced

| Artifact | Path | Status |
|---|---|---|
| Mic permission + speech page | `public/mic-permission.html`, `public/mic-permission.js` | On main |
| Rewritten speech hook | `src/sidepanel/hooks/useSpeechRecognition.ts` | On main |
| Updated speech tests | `tests/sidepanel/hooks/useSpeechRecognition.test.ts` | On main |
| PR #6 (initial mic flow) | GitHub | Merged |

### First successful capture output

Voice, annotations, and cursor tracking all captured simultaneously on https://almostalab.io/. The user narrated UI feedback ("main hero is far too large", "CTA is overlapping with the subtitle") while drawing a circle annotation and hovering over relevant elements. All data correlated with timestamps.

---

## Session 9 — 2026-03-16/17: Mic Tab Lifecycle Fix, Agent Validation, Library Research

**Model:** Claude Opus 4.6 (Anthropic, via Claude Code CLI)
**Human lead:** Braeden Bihag
**AI role:** Bug fixer, researcher, code explorer

### What happened

1. **Mic tab lifecycle bug fixed (PR #18, issue #17).** The mic-permission tab (where SpeechRecognition runs) doesn't persist across browser restarts, but the `chrome.storage.local` grant flag does. On sidepanel mount, the hook now pings the mic tab via `MIC_TAB_PING`. If no response, it reopens the tab automatically. The tab also auto-detects existing mic permission on load and hides the grant button.

2. **Real-world agent validation.** Braeden tested PointDev output on a separate Claude session managing the Almost Impossible Agency website. The AI agent parsed PointDev output and provided actionable feedback:
   - Correctly identified three UI issues from voice + annotations + cursor dwell
   - Requested: screenshots at annotation timestamps, source file mapping, computed styles on annotations, DOM subtree per annotation
   - Key quote: "Loom for humans, annotated screenshots + structured metadata for agents. Same capture session, two output formats."
   - Filed as issues #19, #20, #21

3. **Open source library research.** Investigated three libraries for potential integration:
   - **rrweb** (session replay): Excellent but blocked for Chrome extensions (base64 Worker inlining violates Chrome Web Store policy, open issue #1699). Future milestone target, not PoC.
   - **html2canvas** (DOM screenshots): Not useful. Library's own FAQ says don't use in extensions. We already have `captureVisibleTab`.
   - **pi-annotate** by Nico Bailon (element annotation for Pi agent): Most relevant. Solves similar problem from different angle. Has accessibility capture (ARIA roles), 40+ computed styles, element ancestry cycling. MIT licensed. Cited as prior art.

### Decisions and rationale

| Decision | Made by | Rationale |
|---|---|---|
| Ping mic tab on mount instead of trusting storage flag | AI | Storage persists across restarts but tabs don't |
| Don't integrate rrweb in PoC | AI (research) | Chrome extension CSP blocker, 60MB memory overhead |
| Skip html2canvas entirely | AI (research) | Library FAQ says don't use in extensions; captureVisibleTab is better |
| Cite pi-annotate as prior art | AI + Braeden | Complementary tool, MIT licensed, accessibility patterns worth adopting |
| File agent feedback as issues | Braeden | Real validation from downstream consumer; strengthens roadmap |

### What was AI-generated vs. human-authored

- **AI-generated:** Mic tab lifecycle fix, library exploration and analysis, issue descriptions
- **Human-directed:** Agent validation test (Braeden ran PointDev output through a separate Claude session), decision to research these specific libraries, bug report (mic not working after restart)
- **Human-identified:** The agent validation conversation and its implications for the roadmap

### Artifacts produced

| Artifact | Path | Status |
|---|---|---|
| Mic tab lifecycle fix | `src/sidepanel/hooks/useSpeechRecognition.ts`, `public/mic-permission.js` | PR #18, merged |
| Issue: Screenshot at annotation timestamps | GitHub #19 | Open |
| Issue: Source file path resolution | GitHub #20 | Open |
| Issue: Computed styles in annotation output | GitHub #21 | Open |
| Issue: Mic tab lifecycle | GitHub #17 | Closed (PR #18) |

---

## Session 10 — 2026-03-19: Five-Issue Sprint & Auto-Screenshot Feature

**Model:** Claude Opus 4.6 (Anthropic, via Claude Code CLI)
**Duration:** ~4 hours
**Human lead:** Braeden Bihag
**AI role:** Sprint planner, parallel implementer, reviewer, feature designer

### What happened

1. **Five-issue sprint executed via parallel subagents.** Closed 5 GitHub issues in a single session using isolated git worktrees for parallel development:

   - **#15 — Sidepanel-native speech recognition.** Eliminated the persistent mic-permission tab. SpeechRecognition now runs directly in the sidepanel context. The mic-permission tab only opens as a one-time permission gate and auto-closes. Deleted dead offscreen document code. Removed `offscreen` manifest permission.

   - **#26 — CSS custom property discovery.** Scans `document.styleSheets` for rules matching the selected element, extracts `--custom-property` declarations. Uses duck-typing (`'selectorText' in rule`) instead of `instanceof CSSStyleRule` for cross-frame robustness. Capped at 50 variables. Pattern attributed to pi-annotate by Nico Bailon (MIT).

   - **#25 — Element ancestry cycling.** Alt+scroll in select mode walks up/down the DOM tree from the hovered element. Visual feedback via dashed red outline. Capped at 10 ancestors, skips `data-pointdev` elements, stops at `document.body`. Wheel listener uses `{ passive: false }` for `preventDefault()`.

   - **#8 — Freehand + rectangle annotation tools.** Extended the canvas overlay pipeline with two new annotation types. Freehand collects points on mousemove (3px throttle), rectangle uses two-corner drag. Both follow existing circle/arrow patterns. Extracted `getAnnotationFocalPoint()` helper for nearestElement resolution. Added mode buttons to CaptureControls.

   - **#11 — Console errors + failed network requests.** Injects monkey-patching code into the page's main world via `chrome.scripting.executeScript({ world: 'MAIN' })`. Patches `console.error/warn`, `fetch`, `XMLHttpRequest.send`, and listens for `window.onerror` and `unhandledrejection`. Data bridges back via `CustomEvent('pointdev-console-batch')`. No new permissions required.

2. **Sprint workflow.** Design spec written and reviewed → implementation plan written and reviewed → 5 parallel subagents in isolated worktrees → sequential merge (15 → 26 → 25 → 8 → 11) with conflict resolution → parallel code reviewer + code simplifier.

3. **Post-sprint review and fixes.** Code reviewer found no critical issues. Code simplifier fixed 6 items:
   - `formatBoxModel` unitless value bug (`"8 16 8 16px"` → `"8px 16px 8px 16px"`)
   - Extracted `getAnnotationFocalPoint()` replacing inline `as any` casts
   - Removed 4 redundant `as const` assertions in canvas-overlay
   - Removed unnecessary `beginPath()` before `strokeRect()`
   - Removed unused `captureStartedAt` field from `ConsoleNetworkCapture`
   - Simplified warning label conditional in `formatConsoleNetwork`

4. **Reviewer items addressed.** Rectangle min-size check changed from AND to OR (`w < 10 || h < 10`). Ancestry highlight + freehand points cleaned up on mode change.

5. **Auto-screenshot feature designed and implemented.** Triggers `captureVisibleTab` after every annotation completion and element selection. Dedup logic groups captures within 2s on same scroll position. Screenshots enriched with descriptions and voice context. `ScreenshotThumbnail` component with Copy Image button. Storage strategy: in-memory only (dataUrl stripped from `chrome.storage.session` to avoid 1MB quota).

6. **Screenshot bug identified.** Thumbnails not appearing in sidepanel after capture. Debug logging added to trace the pipeline (content script → service worker → captureVisibleTab). Investigation ongoing.

7. **Submission timeline revised.** NLnet application now targets after March 25 open office hours (originally March 21). Roadmap updated.

### Decisions and rationale

| Decision | Made by | Rationale |
|---|---|---|
| Close 5 issues in one sprint | Braeden | Maximize repo activity before NLnet submission |
| Parallel worktree subagents | Braeden | Proven workflow from Session 2, maximizes throughput |
| Drop #9 (Vue/Svelte detection) from sprint | Braeden (AI recommended) | Hard to test without real Vue/Svelte apps, "help wanted" issue |
| Main-world injection for console capture (#11) | AI (spec reviewer caught) | Content scripts run in isolated world — monkey-patching in content script world would NOT intercept page's console/fetch |
| Duck-typing for CSS rule detection (#26) | AI (plan reviewer caught) | `instanceof CSSStyleRule` fails against mock objects in tests and across frames |
| Screenshot approach A (captureVisibleTab on annotation) over B (video recording) | Braeden chose A, noted C (video) for future | Simpler, no new permissions, canvas already in DOM. Video recording filed as future issue. |
| Submit after March 25 open office, not March 21 | Braeden | Attend NLnet open office hours first for feedback on application |

### What was AI-generated vs. human-authored

- **AI-generated:** Design spec, implementation plan, all 5 feature implementations, all tests, code review reports, code simplification, auto-screenshot design + implementation, debug logging
- **Human-directed:** Sprint scope (which 5 issues), annotation tools scope (freehand + rectangle, no text), auto-screenshot approach selection, submission timeline change, workflow preferences (parallel agents, reviewer + simplifier after sprint)
- **Human-identified:** Screenshot thumbnail bug (from manual testing), dedup as "possible failure vector to test aggressively"
- **AI-identified, human-approved:** Main-world injection architecture, duck-typing for CSS rules, compositor delay for screenshots, in-memory-only storage strategy

### Artifacts produced

| Artifact | Path | Status |
|---|---|---|
| Design spec (5-issue sprint) | `docs/superpowers/specs/2026-03-19-five-issue-sprint-design.md` | Complete |
| Implementation plan (5-issue sprint) | `docs/superpowers/plans/2026-03-19-five-issue-sprint.md` | Complete |
| Sidepanel speech (#15) | `src/sidepanel/hooks/useSpeechRecognition.ts`, `public/mic-permission.js` | Merged, issue closed |
| CSS variable discovery (#26) | `src/content/element-selector.ts` | Merged, issue closed |
| Ancestry cycling (#25) | `src/content/element-selector.ts`, `src/content/index.ts` | Merged, issue closed |
| Freehand + rectangle tools (#8) | `src/content/canvas-overlay.ts`, `src/content/index.ts`, `src/sidepanel/components/CaptureControls.tsx` | Merged, issue closed |
| Console/network capture (#11) | `src/content/console-network-capture.ts`, `src/background/message-handler.ts` | Merged, issue closed |
| Auto-screenshot design spec | `docs/superpowers/specs/2026-03-19-auto-screenshot-design.md` | Complete |
| Auto-screenshot plan | `docs/superpowers/plans/2026-03-19-auto-screenshot.md` | Complete |
| Auto-screenshot implementation | `src/shared/types.ts`, `src/background/message-handler.ts`, `src/content/index.ts`, `src/sidepanel/components/ScreenshotThumbnail.tsx` | Merged, bug under investigation |
| Revised submission roadmap | `docs/submission-roadmap.md` | Updated |
| Test suite | 775 tests across 98 files | All passing |

### Test suite growth

| Session | Tests | Test files |
|---|---|---|
| Session 4 (MVP) | 62 | 10 |
| Session 10 (this session) | 775 | 98 |

### Next steps

- Debug screenshot pipeline (console logs added, awaiting test results)
- Tag v0.1.0 release
- Attend NLnet open office March 25
- Submit application after open office feedback

---

## Session 11 — 2026-03-25: Smart Screenshot Intelligence & Video Annotator Experiment

**Model:** Claude Opus 4.6 (Anthropic, via Claude Code CLI)
**Human lead:** Braeden Bihag
**AI role:** Architecture design, implementation, code review

### What happened

1. **Video frame annotator experiment.** Built a standalone HTML tool (`tools/video-annotator/annotator.html`) that accepts a video file via drag-and-drop, extracts frames client-side using `<video>` + `<canvas>` + `toBlob()` at configurable intervals (default 2.5s), and provides a grid-based review UI for selecting and annotating problem frames. Exports structured markdown for pasting into Claude. This experiment informed the design of the smart screenshot system.

2. **ScreenshotIntelligence module.** Designed and implemented a multi-signal screenshot capture system that replaces the broken event-triggered auto-screenshot. Instead of fixed-interval capture or annotation-triggered capture, screenshots are now taken based on a weighted interest score combining four signals:
   - **Frame differencing (CV):** `tabCapture` MediaStream provides a continuous video feed of the active tab. A 160x90 low-res canvas samples every 2s and compares pixel data against the previous frame using sparse sampling (every 4th pixel). Weight: 0.30.
   - **Cursor dwell:** Real-time dwell detection (800ms threshold, 30px radius) in the service worker sends `DWELL_UPDATE` messages to the sidepanel. Reuses `distance()` from `@shared/dwell`. Weight: 0.25.
   - **Voice activity:** Web Speech API interim/final transcript state feeds a boolean signal. Weight: 0.35.
   - **User annotations:** Bypass scoring entirely (score = 1.0), always capture.
   - Interest threshold: 0.4 with 3-second cooldown between captures.

3. **Removed broken auto-screenshot code.** The old `requestScreenshot()` in `src/content/index.ts` (event-triggered, compositor timing bug) was removed along with its dedup state and obsolete tests. The content script still sends `ANNOTATION_ADDED` and `ELEMENT_SELECTED` messages; the sidepanel intelligence module handles screenshot triggering.

4. **Code quality review and fixes.** Ran a three-agent parallel review (reuse, quality, efficiency) and fixed:
   - Extracted `buildAnnotationDesc()` and `findOverlappingVoice()` helpers to eliminate copy-pasted logic between `SCREENSHOT_REQUEST` and `SMART_SCREENSHOT_REQUEST` handlers
   - Fixed module-level dwell state persisting across sessions (added `resetDwellDetector()` on start/stop)
   - Fixed dwell detector only checking last sample in batch (now scans all samples)
   - Unified duplicate `ScreenshotTrigger` type (defined once in `types.ts`, re-exported from `messages.ts`)
   - Optimized frame differ: sparse pixel sampling (75% reduction), buffer reuse instead of allocation per frame
   - Consolidated two voice-signal effects into one in `App.tsx`

5. **Formatter and UI updates.** Updated `formatScreenshots()` to output signal details (visual change %, dwell element, voice quote, interest score). Updated `ScreenshotThumbnail` component with colored trigger badges and signal breakdown display.

6. **Future phase noted.** Braeden proposed using Claude API to produce human-readable action plan summaries from capture sessions (not for Claude Code — for humans). Parked as future phase due to 0 opCost constraint.

### Decisions and rationale

| Decision | Made by | Rationale |
|---|---|---|
| Use `tabCapture` MediaStream for frame capture (option 3) | Braeden | Cleanest approach for continuous low-res sampling; worth the permission addition |
| Frame interval 2-2.5s instead of 1s | Braeden | Every second is too aggressive; 2-3s matches natural browsing rhythm |
| Voice gets highest non-annotation weight (0.35) | AI, accepted by Braeden | If the user is talking, they're describing something worth capturing |
| Remove old screenshot code entirely | AI, confirmed by Braeden | Old code never worked; new intelligence module is a clean replacement |
| Claude API integration is future phase | Braeden | 0 opCost constraint — everything stays client-side for now |
| Sparse pixel sampling (every 4th pixel) | AI (code review) | 75% reduction in frame diff comparisons with negligible accuracy loss |

### What was AI-generated vs. human-authored

- **AI-generated:** ScreenshotIntelligence class, message types, service worker handlers, dwell detector, formatter updates, thumbnail component changes, video annotator tool, all test code
- **Human-directed:** Architecture choice (tabCapture over alternatives), signal weights, interest threshold, 0 opCost constraint, decision to remove old screenshot code, future API phase scoping
- **Human-originated:** The idea to use lightweight CV for screenshot intelligence, the multi-signal approach combining frame diff + cursor dwell + voice + annotations

### Artifacts produced

| Artifact | Path | Status |
|---|---|---|
| Video frame annotator (experiment) | `tools/video-annotator/annotator.html` | Complete, standalone |
| Screenshot intelligence module | `src/sidepanel/screenshot-intelligence.ts` | Implemented |
| Smart screenshot messages | `src/shared/messages.ts` (new types) | Implemented |
| Extended screenshot types | `src/shared/types.ts` (`ScreenshotTrigger`, signal fields) | Implemented |
| Service worker smart handlers | `src/background/message-handler.ts` | Implemented |
| Sidepanel integration | `src/sidepanel/hooks/useCaptureSession.ts`, `src/sidepanel/App.tsx` | Implemented |
| Formatter signal output | `src/shared/formatter.ts` | Updated |
| Thumbnail trigger badges | `src/sidepanel/components/ScreenshotThumbnail.tsx` | Updated |
| Content script cleanup | `src/content/index.ts` | Old screenshot code removed |
| Intelligence tests | `tests/sidepanel/screenshot-intelligence.test.ts` | 14 tests passing |
| Manifest update | `src/manifest.json` | `tabCapture` permission added |
| Test suite | 784 tests across 98 files | All passing |

### Next steps

- Manual testing of smart screenshot pipeline in Chrome
- Tune interest threshold and signal weights based on real usage
- Issue #19 (screenshot at annotation timestamps) is now superseded by the intelligence module
- Tag v0.1.0 release
- NLnet submission
