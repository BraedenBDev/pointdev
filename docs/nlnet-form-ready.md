# NLnet NGI Zero Commons Fund - Form-Ready Submission

> **URL:** https://nlnet.nl/propose/
> **Deadline:** April 1st 2026, 12:00 CEST
> **Format:** Plain text only (no markdown, no HTML in form fields)

---

## Thematic call

NGI Zero Commons Fund

## Contact information

- Name: Braeden Bihag
- Email: [fill in]
- Phone: [fill in]
- Organisation: Almost a Lab S.L.
- Country: Spain

## Proposal name

PointDev: Open structured context capture for human-to-AI communication on the web

## Website / wiki

https://github.com/BraedenBDev/pointdev

---

## Abstract (1130/1200 chars)

> Paste this into the "Abstract" field. Plain text, no formatting.

MCP standardised how AI agents act on the world. No equivalent exists for humans telling agents what they want with structural precision.

PointDev is an open source Chrome extension that captures structured browser context (DOM selectors, computed styles, React component names, console errors) fused with human intent (voice narration, spatial annotations, cursor dwell) into structured output for AI coding agents.

Working PoC: 118 commits, 1188 tests passing. Implements MCP bridge server, three output formats, console/network capture, screenshot intelligence, annotation tools, on-device Whisper STT, cursor dwell tracking.

This grant funds six milestones: (1) production-hardened local Whisper with AudioWorklet migration, (2) open format specification aligned with W3C Web Annotation/MCP schemas, (3) accessibility context capture (ARIA, a11y tree, contrast ratios), (4) Vue + Svelte detection, (5) Firefox port, (6) compiler extraction as npm package.

Outcome: privacy-first cross-browser extension with local voice transcription, a versioned open format spec any tool can implement, and a standalone compiler library.

---

## Relevant experience (max 2500 chars)

> Paste into "Have you been involved with projects or organisations" field.

I built PointDev because I hit the input bottleneck daily. Running an AI implementation studio, building at AI speed with Claude Code, watching precise visual intent evaporate into lossy text. The PoC exists because the problem was blocking my own work.

Co-founder and CTO of Almost a Lab S.L., a Barcelona-based AI implementation studio. Previously Head of Technology at a creative agency where the problem surfaced from both directions: collecting human feedback at AI speed and receiving unstructured visual feedback from non-technical clients who couldn't articulate intent with technical precision.

Speaker at MWC Barcelona 2025 and 2026 on AI agents and the shift from attention economy to selection economy.

Built and maintain Obscura, an open source PII detection Chrome extension (Flask/GLiNER, 331+ tests). Same MV3 architecture: content scripts, DOM mutation observers, sidepanel UI, cross-context messaging.

Background in experience design and industrial design engineering. User intent capture and interaction design are core competencies.

---

## Requested Amount

25000

---

## Budget (plain text, max 2500 chars)

> Paste into "Explain what the requested budget will be used for" field.

Self-funded to date. The proof of concept was built without grant funding. The grant funds the remaining R&D to take a working PoC to production-quality open infrastructure.

Rate: 300 EUR/day (solo developer, cost-recovery; commercial rate: 1,200 EUR/day)

Milestones:

M1 - Local Whisper transcription, production hardening: AudioWorklet migration, model download/caching UX, memory profiling, streaming audio exploration. ~20 days, 6,000 EUR.

M2 - Open structured output format specification: Version the format, write spec document, align with W3C Web Annotation / MCP schemas, publish. ~12 days, 3,600 EUR.

M3 - Accessibility context capture: ARIA roles, a11y tree, contrast ratios, WCAG violation detection. Adapt pi-annotate patterns (MIT). ~14 days, 4,200 EUR.

M4 - Cross-framework detection (Vue + Svelte): vue-inspector.ts, svelte-inspector.ts following react-inspector.ts pattern, production build fallbacks. ~12 days, 3,600 EUR.

M5 - Firefox cross-browser port: WebExtensions compatibility layer, sidebar_action alternative, CSP differences, testing. ~10 days, 3,000 EUR.

M6 - Prompt compiler npm package + documentation + community engagement: Extract compiler as standalone lib, developer docs, test coverage, MCP ecosystem outreach, demo video, launch posts. ~12 days, 3,600 EUR.

Totals: ~80 days (24,000 EUR) + infrastructure/CI (500 EUR) + contingency (500 EUR) = 25,000 EUR

Other funding: A 3,000 EUR Kit Digital grant (Spanish government, Feb 2026) for unrelated business operations. PointDev has no other funding. This proposal is the first of two grants. Successful completion positions a follow-up proposal for collaborative sharing infrastructure.

---

## Compare with existing efforts (plain text, max 4000 chars)

> Paste into "Compare your own project" field.

No open, vendor-neutral standard captures structured browser context with human intent and delivers it to external tools. Existing approaches capture one side and lose the other.

Browser automation (Playwright, Puppeteer, Claude Computer Use) lets AI agents read and act on pages. PointDev lets humans tell agents what they want with structural precision. They solve opposite directions of the same problem.

Screen recording + annotation (Loom, Jam, BugHerd, Marker.io) capture visual context but produce unstructured video or screenshots without DOM awareness, computed styles, or structured output AI agents can parse. They lock feedback into proprietary platforms with no open export format. A 2-minute Loom recording carries less actionable information than a 3-second PointDev capture that includes the element selector, component name, and console error.

AI coding tools (Cursor, Copilot, Claude Code) gather context through proprietary systems. None captures what the user is looking at or pointing at in the browser. PointDev provides the missing input layer and works with all of them through its MCP-compatible bridge server.

Browser DevTools provide rich technical context but lack intent capture, voice, annotation, and export to external tools. They require technical users.

pi-annotate and similar web annotation tools focus on static annotation without real-time multimodal capture, DOM awareness, or AI consumption.

PointDev is the only tool that fuses human intent (voice, spatial, gaze) with technical context (DOM, styles, components) into structured output AI agents can act on, as open infrastructure.

Each proprietary AI tool is building its own closed context engine. If structured context capture calcifies inside walled gardens, we lose interoperability on the input side of human-AI interaction, the same way we almost lost it on the output side before MCP. An open format established now prevents that lock-in. NLnet has funded this kind of preemptive standards work before.

---

## Technical challenges (plain text, max 5000 chars)

> Paste into "What are significant technical challenges" field.

1. Local speech-to-text in a browser extension context (primary challenge). The Whisper worker and audio pipeline exist. The remaining challenges are concrete: (1) ScriptProcessorNode is deprecated; Chrome warns about removal. Migration to AudioWorklet is needed but AudioWorklet has its own restrictions in extension contexts. (2) The whisper-tiny.en model is ~40MB; first-use download UX and caching strategy need design. (3) 3-second audio chunks cause ~3-5s latency; exploring streaming approaches. (4) Memory footprint of ONNX Runtime WASM in a long-running extension needs profiling. It falls back to single-threaded execution due to Blob worker CSP restrictions. Solving this makes PointDev the first browser extension with local voice transcription, useful to the privacy-first tooling ecosystem beyond this project.

2. Cross-framework component detection. React fiber inspection works (react-inspector.ts). Vue exposes __vue_app__ and __vueParentComponent, Svelte uses __svelte_meta in dev mode, but each has framework-version-specific quirks and production builds strip debug info. Building a reliable, opportunistic detection layer that tries each detector and degrades gracefully to vanilla DOM is the challenge. Issue #9 scopes the architecture.

3. Temporal correlation of cursor, voice, and annotation. The compiler merges three async streams: Web Speech API at irregular intervals, cursor at 100ms fixed sample rate, annotations as discrete events. False correlations ("user said X while cursor was on element Y, but were they looking at Y?") are mitigated by dwell duration thresholds, but the heuristics need tuning against real-world capture sessions. The PoC's dwell detection works but I haven't validated it at scale.

4. CSS selector to source file resolution. React fiber's _debugSource provides file:line in dev builds. Production builds strip this. Source map resolution for production is a stretch goal. The dev-build path covers the primary use case: developers testing their own sites. Issue #20 scopes realistic boundaries.

5. Structured output format specification design. Three formatters work but the format isn't documented as a standalone spec. The research problem: how to version and document the format so other tools can implement it, while aligning with existing specs (W3C Web Annotation for spatial data, MCP tool schemas for AI consumption, OpenAI function calling for breadth).

6. Cross-browser WebExtensions compatibility. Chrome and Firefox have diverging MV3 implementations. sidePanel API has no Firefox equivalent (Firefox uses sidebar_action with different lifecycle). The CSP wasm-unsafe-eval needed for Transformers.js WASM may have different support. captureVisibleTab availability and timing differ. Issue #34 scopes the investigation.

---

## Ecosystem (plain text, max 2500 chars)

> Paste into "Describe the ecosystem" field.

MCP, OpenAI Agents SDK, and similar protocols define how agents act on the world. None define how humans communicate visual intent back to those agents through the browser. PointDev is the first attempt at that input protocol.

Relevant actors:

AI coding tool maintainers (Claude Code, Aider, Cursor, Continue): Downstream consumers of PointDev output. The MCP bridge server works. Publishing it as a formal MCP tool specification is M2/M6 work.

MCP community (Anthropic): The bridge server implements MCP-compatible tool handlers. Next step: propose PointDev as a formal MCP context-capture tool specification.

Accessibility community (ARIA/WCAG practitioners, assistive technology developers): Accessibility capture (M3) enables auditors to narrate screen reader experiences and produce structured output AI agents can act on.

Design and product teams / non-technical stakeholders: The format carries technical precision regardless of who captures. A client circles the hero text and says "this feels too corporate," and the capture includes full DOM context.

UX research and QA communities: Structured captures replace screen recordings and vague bug reports.

W3C Web Annotation: The annotation format could align with or extend existing W3C Web Annotation specifications.

How I'll engage: Publish the format spec as an open document for community feedback. Open PRs on open source AI tools (Aider, Continue) demonstrating format integration. Propose a formal MCP context-capture tool specification. Technical blog post on detection architecture. Launch posts on r/ClaudeAI, r/cursor, Hacker News, IndieHackers. Present at FOSDEM, local meetups, MWC/4YFN network. Write documentation for developers and non-technical users.

Sustainability: MIT licensed. Beyond the grant: (1) open format adoption creates ecosystem value, (2) hosted relay/sharing service is the paid offering, with the open format preventing lock-in. This is the first of two grants. A follow-up funds collaborative sharing infrastructure.

---

## GenAI Disclosure

> Select: "I did not use generative AI in writing this proposal"

> The form has a radio button. Select that option. The GenAI context is communicated
> through the repository itself (README, Co-Authored-By tags, development log)
> and through the attached development log.

---

## ATTACHMENTS - WHAT TO INCLUDE

### Attachment 1: Project Detail PDF (CREATE THIS)

A 1-2 page PDF containing the content that got compressed out of the 1200-char abstract.
Include:

1. The full problem statement (from nlnet-draft-v6.md "The problem" section)
2. Real capture output example:
   ```
   [00:06] "main hero is far too large"
   [00:23] "the scroll CTA is overlapping with the subtitle"
   1. [00:40] Circle around .lg\:min-h-\[100svh\] at (42, 1019)
   - Dwelled 25.5s over h1.font-display.text-hero (during: "main hero")
   - Dwelled 7.3s over div.absolute.bottom-10 (during: "scroll CTA")
   ```
3. Architecture diagram: Sidepanel <-> Service Worker <-> Content Script
4. The full "What's built" and "What the grant funds" breakdown
5. The "What exists at the end" outcome list

### Attachment 2: GenAI Development Log

> File: docs/genai-disclosure/development-log.md

This is a strong differentiator. It shows:
- Per-session transparency of AI vs. human contributions
- Models used, decisions made, artifacts produced
- Failed approaches documented alongside successes
- NLnet GenAI policy compliance baked into the workflow

### Attachment 3 (optional): Architecture Diagram

A simple diagram showing the four MV3 contexts and message flow.
Only if you have time to make one. The project detail PDF can include a text version.
