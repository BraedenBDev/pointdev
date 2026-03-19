# NLnet Submission Roadmap — March 16-21, 2026

> **Target:** Submit NLnet NGI Zero Commons Fund application by Friday March 21.
> **Budget:** 2-3 hours/day alongside AAL work.
> **Repo:** https://github.com/BraedenBDev/pointdev
> **Form:** https://nlnet.nl/propose/

---

## Sunday March 15 (today) — DONE

**Completed:**
- Canvas scroll anchoring fixed (PR #5, merged)
- Message channel cleanup (PR #5, merged)
- Microphone permission flow working (PR #6 + follow-ups)
- First full capture with voice + annotations + cursor tracking
- README updated with real capture output
- CONTRIBUTING.md added
- Docs moved to `docs/design/`
- 10 GitHub issues filed (roadmap + bugs)
- GenAI development log current through Session 8

---

## Monday March 16 — Read, React, Light Repo Work

### Application (1 hour)
- [ ] Print or tablet-read the full draft application (`pointdev-nlnet-merged-v3.md`)
- [ ] Read once without editing
- [ ] Mark anything that doesn't sound like you
- [ ] Mark anything you disagree with or want to cut
- [ ] Mark anything missing from the proof of concept experience
- [ ] Sleep on it — don't write yet

### Repo (1 hour)
- [ ] File 2-3 new issues from "testing observations" (spread them out, not a batch)
  - Suggestion: "Capture session lost on tab switch", "Dark mode contrast issues in sidepanel", "Annotation color should be configurable"
- [ ] Comment on existing issues with technical notes (e.g., #7 local STT, #10 output formats)
- [ ] Fix #16 (scroll-while-drawing preview) — small, clean PR
  - Suppress scroll-triggered redraws while `drawStart !== null`
  - ~10 line change, creates natural commit activity

---

## Tuesday March 17 — Abstract Rewrite (CRITICAL DAY)

### Application (3 hours)
- [ ] Rewrite the abstract from scratch in your own voice
  - The abstract is what reviewers read first and score most heavily
  - Take the draft's structure but write every sentence yourself
  - Cut by 30% — aim under 600 words (currently ~800)
  - Keep the numbered deliverables (detection engine, compiler library, prompt format spec, reference implementation) as the backbone
  - Rewrite the prose around them
- [ ] Read the rewrite aloud — if it doesn't sound like you talking to a peer, rewrite again

### Repo (30 min)
- [ ] Push one small PR: fix #14 (first-click fallback)
  - Add `chrome.scripting.executeScript` fallback when PING fails
  - Real UX improvement, clean diff
- [ ] Comment on #7 with research notes about Whisper.cpp / Chrome on-device STT feasibility

---

## Wednesday March 18 — Rewrite Everything Else

### Application (3 hours)
- [ ] Budget section: review milestone descriptions, make sure they match what you're actually planning to build. Adjust hours if needed. The numbers are real — don't second-guess unless something is genuinely wrong.
- [ ] Competitive section, technical challenges, ecosystem: more factual, easier rewrites. Pass through once, make them yours, move on.
- [ ] GenAI disclosure section: light touch. Make sure dates and model references are accurate. Link to the GitHub development log.
- [ ] Review the "Relevance to NGI Zero" framing — does it clearly connect PointDev to the internet commons mission?

### Repo (1 hour)
- [ ] One meaty PR: either #15 (eliminate mic tab requirement) or #8 (add rectangle annotation tool)
  - #8 is safer and more visible — adds a concrete feature
  - Creates a commit with real feature work mid-week
- [ ] Update GenAI development log with the day's work

---

## Thursday March 19 — Polish and Prepare

### Application (2 hours)
- [ ] Go to https://nlnet.nl/propose/ and paste each section into the actual form fields
  - The form is plain text, not markdown — strip formatting that doesn't render
  - Check character/word limits on each field
- [ ] Export Claude conversations as PDFs for GenAI disclosure attachment
  - Include this session and any earlier PointDev conversations
  - Save to a folder you can upload
- [ ] Do a final read of everything in the form itself
  - Read as if you're a reviewer seeing it for the first time
  - Does the abstract hook you?
  - Does the budget make sense?
  - Does the PoC link work and show a credible project?

### Repo (30 min)
- [ ] Tag `v0.1.0` release on GitHub with a short release description
  - `gh release create v0.1.0 --title "v0.1.0 — Proof of Concept" --notes "..."`
  - Include: what works, what's next, link to the real capture output in README
- [ ] Make sure README links, installation steps, and CONTRIBUTING.md are all accurate
- [ ] Last commit of the week — don't touch the repo Friday

---

## March 20-24 — Polish Window

**Timeline revised:** Submission now targets AFTER the NLnet open office hours on March 25.

### Repo
- [ ] Fix auto-screenshot bug (thumbnails not appearing — debug logging active)
- [ ] Tag `v0.1.0` release
- [ ] Update GenAI development log (Sessions 9-10)
- [ ] Continue fixing open issues if time allows

### Application
- [ ] Refine application based on any insights from additional testing
- [ ] Export Claude conversations as PDFs for GenAI disclosure

---

## Tuesday March 25 — NLnet Open Office Hours

- [ ] Attend open office session
- [ ] Ask questions about the application process, scoring, and format
- [ ] Note any feedback on framing or approach
- [ ] Revise application based on feedback

---

## March 26-31 — Submit

- [ ] Final read of everything in the form
- [ ] Verify all links work (GitHub repo, GenAI log, design spec)
- [ ] Verify attachments uploaded
- [ ] Submit before April 1 deadline
- [ ] Don't tinker after submitting

---

## Buffer: April 1 Deadline

If something goes wrong or you want to revise:
- NLnet takes the last complete version submitted before April 1
- You can resubmit with improvements
- NLnet Office Hours may happen in this window — attend if available
- Use buffer time for repo improvements (more issues, PRs, documentation) that strengthen the application

---

## What Reviewers Will Check

When they click your GitHub link, they'll look for:

| Signal | Status |
|--------|--------|
| Working code, not just docs | 84 tests, builds, real capture output |
| Active development | Commits spread Mon-Thu, issues with discussion |
| Clear architecture | CLAUDE.md, docs/design/, clean file structure |
| Community readiness | CONTRIBUTING.md, labeled issues, MIT license |
| Transparency | GenAI development log, Co-Authored-By tags |
| Roadmap | 10 open issues with labels, "Current Limitations" in README |
| Proof it works | Real capture output in README from actual use |

---

## Files Reference

| What | Where |
|------|-------|
| Draft application | `pointdev-nlnet-merged-v3.md` (your local copy) |
| Design spec | `docs/design/mvp-design.md` |
| Implementation plan | `docs/design/mvp-implementation-plan.md` |
| GenAI development log | `docs/genai-disclosure/development-log.md` |
| Pending fixes | `docs/design/pending-fixes.md` |
| This roadmap | `docs/submission-roadmap.md` |
