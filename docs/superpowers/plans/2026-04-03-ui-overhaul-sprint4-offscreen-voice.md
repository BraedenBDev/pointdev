# UI Overhaul Sprint 4: Offscreen Document Voice Migration Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate both voice engines (Web Speech API + Whisper) from the sidepanel to an offscreen document. This decouples voice recognition from the sidepanel, allowing it to close during capture.

**Architecture:** An offscreen document (offscreen.html) hosts voice recognition. It receives VOICE_START/VOICE_STOP messages from the service worker, runs the selected engine, and sends TRANSCRIPT_UPDATE back. The existing whisper-worker.ts moves to the offscreen context.

---

## Task 1: Create offscreen document

- Create `src/offscreen/offscreen.html` — minimal HTML with script tag
- Create `src/offscreen/offscreen.ts` — voice orchestration:
  - Listen for VOICE_START { engine: 'web-speech'|'whisper', captureStartedAt }
  - Listen for VOICE_STOP
  - Fast mode: create SpeechRecognition, send transcripts to SW
  - Private mode: getUserMedia → AudioContext → Whisper Worker → transcripts to SW
- Copy whisper-worker.ts to offscreen context (or import from shared location)

## Task 2: Update manifest

- Add "offscreen" permission to src/manifest.json
- Update CSP if needed for offscreen context

## Task 3: Update service worker

- On START_CAPTURE: create offscreen document with chrome.offscreen.createDocument()
- Send VOICE_START to offscreen doc with engine preference
- On STOP_CAPTURE: send VOICE_STOP, then chrome.offscreen.closeDocument()
- Route TRANSCRIPT_UPDATE from offscreen → session store + floating card

## Task 4: Update sidepanel

- Remove voice hooks from App.tsx (useSpeechRecognition, useWhisperRecognition)
- Engine selection in IdleView sends preference to service worker (stored in chrome.storage)
- Sidepanel no longer manages voice — offscreen doc handles it
- Remove mic permission flow from sidepanel (offscreen doc handles getUserMedia)

## Task 5: Update content script

- Forward TRANSCRIPT_SNIPPET to floating card for live display
- No voice-related code in content script

## Task 6: Tests + verification

- Test offscreen voice orchestration (message flow)
- Test service worker offscreen lifecycle (create/destroy)
- Verify both engines work end-to-end
- Full test suite + production build
