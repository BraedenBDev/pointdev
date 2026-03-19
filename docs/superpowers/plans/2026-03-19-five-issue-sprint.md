# Five-Issue Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 5 GitHub issues (#15, #26, #25, #8, #11) to strengthen the PointDev repo before NLnet submission.

**Architecture:** Each issue is independent and can be implemented in parallel via isolated worktrees. Merges happen sequentially: #15 → #26 → #25 → #8 → #11. Shared files (`types.ts`, `messages.ts`, `formatter.ts`, `index.ts`) will have merge conflicts resolved at merge time.

**Tech Stack:** TypeScript, React 18, Vite, Chrome MV3 APIs, Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-five-issue-sprint-design.md`

---

## Task 1: Sidepanel-Native Speech Recognition (#15)

**Closes:** GitHub issue #15

**Files:**
- Modify: `src/sidepanel/hooks/useSpeechRecognition.ts` (full rewrite)
- Modify: `public/mic-permission.js` (simplify to permission-only)
- Modify: `public/mic-permission.html` (update copy)
- Delete: `public/offscreen.js`
- Delete: `public/offscreen.html`
- Modify: `src/manifest.json` (remove `offscreen` permission)
- Modify: `tests/sidepanel/hooks/useSpeechRecognition.test.ts` (full rewrite)

- [ ] **Step 1: Delete dead offscreen code and update manifest**

Delete `public/offscreen.js` and `public/offscreen.html`. Remove `"offscreen"` from the permissions array in `src/manifest.json:6`. The permissions line should become:

```json
"permissions": ["activeTab", "scripting", "sidePanel", "storage"],
```

- [ ] **Step 2: Simplify mic-permission.js to permission-only + auto-close**

Replace `public/mic-permission.js` with a minimal permission-acquisition script. Remove all SpeechRecognition code, SPEECH_START/STOP handlers, and the recognition functions. Keep only:

```javascript
// Permission-only page. Acquires microphone permission for the extension origin,
// then auto-closes. Speech recognition runs in the sidepanel.

const btn = document.getElementById('grant');
const status = document.getElementById('status');

(async function init() {
  try {
    const permStatus = await navigator.permissions.query({ name: 'microphone' });
    if (permStatus.state === 'granted') {
      chrome.storage.local.set({ pointdev_mic_granted: true });
      chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' });
      status.textContent = 'Microphone permission granted. You can close this tab.';
      status.className = 'status success';
      btn.style.display = 'none';
      // Auto-close after a brief delay so user sees confirmation
      setTimeout(() => window.close(), 1500);
      return;
    }
  } catch { /* permissions.query not available — show button */ }

  chrome.runtime.sendMessage({ type: 'MIC_TAB_READY' });
})();

btn.addEventListener('click', async () => {
  btn.disabled = true;
  status.textContent = 'Requesting access...';
  status.className = 'status';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());

    btn.style.display = 'none';
    status.textContent = 'Microphone permission granted. Closing this tab...';
    status.className = 'status success';

    chrome.storage.local.set({ pointdev_mic_granted: true });
    chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' });
    // Auto-close
    setTimeout(() => window.close(), 1500);
  } catch (err) {
    status.textContent = 'Permission denied. Please try again and click "Allow" when prompted.';
    status.className = 'status error';
    btn.disabled = false;
  }
});

// Respond to ping from sidepanel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'MIC_TAB_PING') {
    sendResponse({ alive: true });
  }
  return false;
});
```

- [ ] **Step 3: Update mic-permission.html copy**

In `public/mic-permission.html`, change the `<p>` text from:

```html
<p>Voice narration requires your browser's permission to use the microphone. Click below and allow when prompted.</p>
```

to:

```html
<p>Voice narration requires microphone permission. Click below and allow when prompted. This tab will close automatically.</p>
```

- [ ] **Step 4: Rewrite useSpeechRecognition.ts — sidepanel-native speech**

Replace `src/sidepanel/hooks/useSpeechRecognition.ts` entirely:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import type { VoiceSegment } from '@shared/types'

interface UseSpeechRecognitionReturn {
  isAvailable: boolean
  isListening: boolean
  micPermission: 'checking' | 'granted' | 'needs-setup'
  transcript: string
  interimTranscript: string
  segments: VoiceSegment[]
  error: string | null
  requestMicPermission: () => void
  start: (captureStartedAt: number) => void
  stop: () => void
}

const MIC_GRANTED_KEY = 'pointdev_mic_granted'
const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

// Speech recognition now runs directly in the sidepanel context.
// The mic-permission tab is only used as a one-time permission gate
// (it auto-closes after granting). Once permission is granted at the
// extension origin, SpeechRecognition works in any extension page.
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [micPermission, setMicPermission] = useState<'checking' | 'granted' | 'needs-setup'>('checking')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [segments, setSegments] = useState<VoiceSegment[]>([])
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const captureStartRef = useRef(0)
  const processedResultsRef = useRef(0)

  // Check mic permission on mount
  useEffect(() => {
    async function checkPermission() {
      // First check storage flag
      const hasFlag = await chrome.storage.local.get(MIC_GRANTED_KEY)
        .then(s => !!s[MIC_GRANTED_KEY])
        .catch(() => false)

      if (hasFlag) {
        // Verify permission is still granted
        try {
          const permStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          if (permStatus.state === 'granted') {
            setMicPermission('granted')
            return
          }
        } catch {
          // permissions.query not available — try getUserMedia
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.getTracks().forEach(t => t.stop())
            setMicPermission('granted')
            return
          } catch {
            // Permission revoked or not available
          }
        }
      }

      setMicPermission('needs-setup')
    }

    checkPermission()
  }, [])

  // Listen for MIC_PERMISSION_GRANTED from the permission tab
  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'MIC_PERMISSION_GRANTED') {
        setMicPermission('granted')
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const requestMicPermission = useCallback(async () => {
    // Try getting permission directly in sidepanel first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      chrome.storage.local.set({ [MIC_GRANTED_KEY]: true })
      setMicPermission('granted')
      return
    } catch {
      // Sidepanel can't show permission prompt — fall back to tab
    }
    window.open(chrome.runtime.getURL('mic-permission.html'))
  }, [])

  const start = useCallback((captureStartedAt: number) => {
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition not available in this browser.')
      return
    }
    if (micPermission !== 'granted') {
      setError('Microphone not enabled. Click "Setup Microphone" first.')
      return
    }

    setTranscript('')
    setInterimTranscript('')
    setSegments([])
    setError(null)
    captureStartRef.current = captureStartedAt
    processedResultsRef.current = 0

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: any) => {
      let interim = ''
      const newSegments: VoiceSegment[] = []

      for (let i = processedResultsRef.current; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          if (text) {
            const now = Date.now()
            newSegments.push({
              text,
              startMs: now - captureStartRef.current - 1000,
              endMs: now - captureStartRef.current,
            })
          }
          processedResultsRef.current = i + 1
        } else {
          interim += result[0].transcript
        }
      }

      if (newSegments.length > 0) {
        setSegments(prev => {
          const updated = [...prev, ...newSegments]
          setTranscript(updated.map(s => s.text).join(' '))
          return updated
        })
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please grant permission and try again.')
        setMicPermission('needs-setup')
        chrome.storage.local.remove(MIC_GRANTED_KEY)
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError('Speech error: ' + event.error)
      }
    }

    recognition.onend = () => {
      // Auto-restart for continuous recognition while ref is set
      if (recognitionRef.current === recognition) {
        try { recognition.start() } catch { /* already stopped */ }
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [micPermission])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      const r = recognitionRef.current
      recognitionRef.current = null
      r.stop()
    }
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  return {
    isAvailable: !!SpeechRecognitionAPI,
    isListening, micPermission,
    transcript, interimTranscript, segments, error,
    requestMicPermission, start, stop,
  }
}
```

- [ ] **Step 5: Rewrite tests for sidepanel-native speech**

Replace `tests/sidepanel/hooks/useSpeechRecognition.test.ts` entirely:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSpeechRecognition } from '../../../src/sidepanel/hooks/useSpeechRecognition'

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  onstart: (() => void) | null = null
  onresult: ((e: any) => void) | null = null
  onerror: ((e: any) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn(() => { this.onstart?.() })
  stop = vi.fn(() => { this.onend?.() })
}

const messageListeners: Array<(message: any) => void> = []

beforeEach(() => {
  messageListeners.length = 0
  vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition)
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: vi.fn((fn: any) => messageListeners.push(fn)),
        removeListener: vi.fn(),
      },
      sendMessage: vi.fn(),
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({ pointdev_mic_granted: true }),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
  })
  // Mock navigator.permissions.query
  Object.defineProperty(navigator, 'permissions', {
    value: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
    writable: true,
    configurable: true,
  })
})

describe('useSpeechRecognition', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isListening).toBe(false)
    expect(result.current.transcript).toBe('')
    expect(result.current.segments).toEqual([])
  })

  it('reports available when SpeechRecognition exists', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isAvailable).toBe(true)
  })

  it('resolves to granted when storage flag and permission match', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.micPermission).toBe('granted')
  })

  it('resolves to needs-setup when no storage flag', async () => {
    (chrome.storage.local.get as any).mockResolvedValue({})
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.micPermission).toBe('needs-setup')
  })

  it('creates SpeechRecognition locally on start', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    act(() => { result.current.start(Date.now()) })
    expect(result.current.isListening).toBe(true)
  })

  it('does not send SPEECH_START message (speech is local)', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    act(() => { result.current.start(Date.now()) })
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SPEECH_START' })
    )
  })

  it('stops recognition on stop()', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    act(() => { result.current.start(Date.now()) })
    act(() => { result.current.stop() })
    expect(result.current.isListening).toBe(false)
  })

  it('receives MIC_PERMISSION_GRANTED from tab fallback', async () => {
    (chrome.storage.local.get as any).mockResolvedValue({})
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.micPermission).toBe('needs-setup')

    act(() => {
      messageListeners.forEach(fn => fn({ type: 'MIC_PERMISSION_GRANTED' }))
    })
    expect(result.current.micPermission).toBe('granted')
  })
})
```

- [ ] **Step 6: Run tests**

Run: `bun test tests/sidepanel/hooks/useSpeechRecognition.test.ts`

Expected: All tests pass.

- [ ] **Step 7: Run full test suite to check for regressions**

Run: `bun test`

Expected: All tests pass. The formatter test's `makeSession` helper will need `consoleErrors` and `failedRequests` only after Task 5 is merged — at this point it should still work since we haven't changed `CaptureSession` yet.

- [ ] **Step 8: Commit**

```bash
git rm public/offscreen.js public/offscreen.html
git add src/sidepanel/hooks/useSpeechRecognition.ts public/mic-permission.js public/mic-permission.html src/manifest.json tests/sidepanel/hooks/useSpeechRecognition.test.ts
git commit -m "feat: move speech recognition to sidepanel, eliminate persistent mic tab (#15)

Speech recognition now runs directly in the sidepanel context instead of
a dedicated mic-permission tab. The tab only opens as a one-time permission
gate and auto-closes. Removes dead offscreen document code.

Closes #15

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: CSS Custom Property Discovery (#26)

**Closes:** GitHub issue #26

**Files:**
- Modify: `src/content/element-selector.ts` (add `discoverCssVariables`)
- Modify: `src/shared/types.ts` (add `cssVariables` field)
- Modify: `src/content/index.ts` (wire up CSS variable discovery)
- Modify: `src/shared/formatter.ts` (render CSS variables)
- Modify: `tests/content/element-selector.test.ts` (add tests)
- Modify: `tests/shared/formatter.test.ts` (add tests)

- [ ] **Step 1: Write failing test for discoverCssVariables**

Add to `tests/content/element-selector.test.ts`:

```typescript
import { discoverCssVariables } from '../../src/content/element-selector'

describe('discoverCssVariables', () => {
  it('extracts CSS custom properties from matching rules', () => {
    const mockElement = {
      matches: vi.fn((selector: string) => selector === '.card'),
    }
    const mockDoc = {
      styleSheets: [{
        cssRules: [{
          // Duck-type: has selectorText and style = looks like a CSSStyleRule
          selectorText: '.card',
          style: {
            length: 2,
            0: '--card-bg',
            1: '--card-padding',
            getPropertyValue: (prop: string) => {
              const vals: Record<string, string> = { '--card-bg': '#fff', '--card-padding': '16px' }
              return vals[prop] || ''
            },
          },
        }],
      }],
    }

    const vars = discoverCssVariables(mockElement as any, mockDoc as any)
    expect(vars['--card-bg']).toBe('#fff')
    expect(vars['--card-padding']).toBe('16px')
  })

  it('caps at 50 variables', () => {
    const props = Array.from({ length: 60 }, (_, i) => `--var-${i}`)
    const mockElement = { matches: vi.fn(() => true) }
    const mockRule = {
      selectorText: '.big',
      style: {
        length: 60,
        ...Object.fromEntries(props.map((p, i) => [i, p])),
        getPropertyValue: (prop: string) => 'value',
        item: (i: number) => props[i],
      },
    }
    const mockDoc = {
      styleSheets: [{ cssRules: [mockRule] }],
    }

    const vars = discoverCssVariables(mockElement as any, mockDoc as any)
    expect(Object.keys(vars).length).toBe(50)
  })

  it('skips cross-origin sheets that throw', () => {
    const mockElement = { matches: vi.fn(() => true) }
    const mockDoc = {
      styleSheets: [{
        get cssRules() { throw new DOMException('SecurityError') },
      }],
    }

    const vars = discoverCssVariables(mockElement as any, mockDoc as any)
    expect(Object.keys(vars).length).toBe(0)
  })

  it('handles element.matches throwing SyntaxError', () => {
    const mockElement = {
      matches: vi.fn((sel: string) => {
        if (sel.includes('::')) throw new DOMException('SyntaxError')
        return sel === '.card'
      }),
    }
    const mockDoc = {
      styleSheets: [{
        cssRules: [
          { selectorText: '.card::before', style: { length: 1, 0: '--x', getPropertyValue: () => '1' } },
          { selectorText: '.card', style: { length: 1, 0: '--y', getPropertyValue: () => '2' } },
        ],
      }],
    }

    const vars = discoverCssVariables(mockElement as any, mockDoc as any)
    expect(vars['--y']).toBe('2')
    expect(vars['--x']).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/content/element-selector.test.ts`

Expected: FAIL — `discoverCssVariables` is not exported.

- [ ] **Step 3: Implement discoverCssVariables**

Add to `src/content/element-selector.ts` after the existing `findNearestElement` function:

```typescript
export function discoverCssVariables(element: Element, doc: Document): Record<string, string> {
  const vars: Record<string, string> = {}
  let count = 0
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        // Duck-type check instead of instanceof — more robust across frames
        if (!('selectorText' in rule) || !('style' in rule)) continue
        const styleRule = rule as CSSStyleRule
        try {
          if (!element.matches(styleRule.selectorText)) continue
        } catch { continue }
        for (let i = 0; i < styleRule.style.length; i++) {
          const prop = styleRule.style[i]
          if (prop.startsWith('--') && count < 50) {
            vars[prop] = styleRule.style.getPropertyValue(prop)
            count++
          }
        }
      }
    } catch { /* cross-origin sheets throw SecurityError */ }
  }
  return vars
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/content/element-selector.test.ts`

Expected: All tests pass.

- [ ] **Step 5: Add cssVariables to SelectedElementData**

In `src/shared/types.ts`, add to the `SelectedElementData` interface after `reactComponent`:

```typescript
  cssVariables?: Record<string, string>
```

- [ ] **Step 6: Wire up in content script index.ts**

In `src/content/index.ts`, add import:

```typescript
import { extractElementData, findNearestElement, discoverCssVariables } from './element-selector'
```

Then in `handleClick`, after the React inspection block (after line 54), add:

```typescript
  // Discover CSS custom properties
  const cssVars = discoverCssVariables(element, document)
  if (Object.keys(cssVars).length > 0) {
    data.cssVariables = cssVars
  }
```

- [ ] **Step 7: Add CSS variables to formatter**

In `src/shared/formatter.ts`, in the `formatTargetElement` function, after the box model line (after the `el.boxModel` check), add:

```typescript
  if (el.cssVariables && Object.keys(el.cssVariables).length > 0) {
    const varStr = Object.entries(el.cssVariables)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
    lines.push(`- CSS Variables: ${varStr}`)
  }
```

- [ ] **Step 8: Add formatter test for CSS variables**

Add to `tests/shared/formatter.test.ts`:

```typescript
  it('formats CSS variables when present', () => {
    const output = formatSession(makeSession({
      selectedElement: {
        selector: '.card',
        computedStyles: {},
        domSubtree: '<div class="card"></div>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
        cssVariables: { '--primary': '#2563eb', '--spacing': '16px' },
      },
    }))
    expect(output).toContain('CSS Variables: --primary: #2563eb, --spacing: 16px')
  })

  it('omits CSS variables line when none found', () => {
    const output = formatSession(makeSession({
      selectedElement: {
        selector: '.card',
        computedStyles: {},
        domSubtree: '<div class="card"></div>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
      },
    }))
    expect(output).not.toContain('CSS Variables')
  })
```

- [ ] **Step 9: Run all tests**

Run: `bun test`

Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/content/element-selector.ts src/shared/types.ts src/content/index.ts src/shared/formatter.ts tests/content/element-selector.test.ts tests/shared/formatter.test.ts
git commit -m "feat: discover CSS custom properties on selected elements (#26)

Scans document.styleSheets for rules matching the selected element and
extracts --custom-property declarations. Capped at 50 variables. Handles
cross-origin sheets and pseudo-element selector SyntaxErrors gracefully.

Pattern from pi-annotate by Nico Bailon (MIT).

Closes #26

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Element Ancestry Cycling (#25)

**Closes:** GitHub issue #25

**Files:**
- Modify: `src/content/element-selector.ts` (add `getAncestryChain`)
- Modify: `src/content/index.ts` (add wheel handler, ancestry state, highlight)
- Create: `tests/content/ancestry.test.ts`

- [ ] **Step 1: Write failing test for getAncestryChain**

Create `tests/content/ancestry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { getAncestryChain } from '../../src/content/element-selector'

function mockElement(tag: string, attrs: Record<string, string> = {}, parent?: any): any {
  const el = {
    tagName: tag.toUpperCase(),
    parentElement: parent || null,
    hasAttribute: vi.fn((name: string) => name in attrs),
    getAttribute: vi.fn((name: string) => attrs[name] || null),
  }
  return el
}

describe('getAncestryChain', () => {
  it('returns chain from element to ancestors', () => {
    const grandparent = mockElement('section')
    const parent = mockElement('div', {}, grandparent)
    const child = mockElement('span', {}, parent)

    const chain = getAncestryChain(child)
    expect(chain).toHaveLength(3)
    expect(chain[0].tagName).toBe('SPAN')
    expect(chain[1].tagName).toBe('DIV')
    expect(chain[2].tagName).toBe('SECTION')
  })

  it('stops at document.body', () => {
    const body = mockElement('body')
    const div = mockElement('div', {}, body)
    const span = mockElement('span', {}, div)

    const chain = getAncestryChain(span)
    expect(chain).toHaveLength(2) // span, div — stops before body
    expect(chain[chain.length - 1].tagName).toBe('DIV')
  })

  it('caps at maxDepth', () => {
    // Build a chain of 15 elements
    let current: any = mockElement('div')
    for (let i = 0; i < 14; i++) {
      current = mockElement('div', {}, current)
    }

    const chain = getAncestryChain(current, 10)
    expect(chain).toHaveLength(10)
  })

  it('skips elements with data-pointdev attribute', () => {
    const grandparent = mockElement('section')
    const overlay = mockElement('div', { 'data-pointdev': 'overlay' }, grandparent)
    const child = mockElement('span', {}, overlay)

    const chain = getAncestryChain(child)
    // Should skip the overlay element
    expect(chain.find((el: any) => el.hasAttribute('data-pointdev'))).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/content/ancestry.test.ts`

Expected: FAIL — `getAncestryChain` not exported.

- [ ] **Step 3: Implement getAncestryChain**

Add to `src/content/element-selector.ts`:

```typescript
export function getAncestryChain(element: Element, maxDepth = 10): Element[] {
  const chain: Element[] = [element]
  let current = element.parentElement
  while (current && current.tagName !== 'BODY' && current.tagName !== 'HTML' && chain.length < maxDepth) {
    if (!current.hasAttribute('data-pointdev')) {
      chain.push(current)
    }
    current = current.parentElement
  }
  return chain
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/content/ancestry.test.ts`

Expected: All tests pass.

- [ ] **Step 5: Add ancestry cycling to content script**

In `src/content/index.ts`, add these module-level variables after the existing drawing state:

```typescript
// Ancestry cycling state
let hoveredElement: Element | null = null
let ancestryChain: Element[] = []
let ancestryIndex = 0
let highlightEl: HTMLElement | null = null
```

Add import for `getAncestryChain`:

```typescript
import { extractElementData, findNearestElement, getAncestryChain } from './element-selector'
```

Add these functions before `startCapture`:

```typescript
function updateHighlight(element: Element | null) {
  if (highlightEl) {
    highlightEl.remove()
    highlightEl = null
  }
  if (!element) return

  const rect = element.getBoundingClientRect()
  highlightEl = document.createElement('div')
  highlightEl.setAttribute('data-pointdev', 'highlight')
  Object.assign(highlightEl.style, {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    outline: '2px dashed #FF3333',
    pointerEvents: 'none',
    zIndex: '2147483646',
  })
  document.body.appendChild(highlightEl)
}

function handleWheel(e: WheelEvent) {
  if (!isCapturing || currentMode !== 'select' || !e.altKey) return
  e.preventDefault()

  if (ancestryChain.length === 0) return

  if (e.deltaY < 0) {
    // Scroll up = select parent
    ancestryIndex = Math.min(ancestryIndex + 1, ancestryChain.length - 1)
  } else {
    // Scroll down = select child
    ancestryIndex = Math.max(ancestryIndex - 1, 0)
  }

  updateHighlight(ancestryChain[ancestryIndex])
}
```

Modify `handleClick` to use ancestry-adjusted element. Replace the `findNearestElement` call:

```typescript
  // Use ancestry-adjusted element if available, otherwise findNearestElement
  const element = (ancestryChain.length > 0 && hoveredElement)
    ? ancestryChain[ancestryIndex]
    : findNearestElement(e.clientX, e.clientY, document)
  if (!element) return
```

Add mousemove handler for ancestry tracking. In the existing `handleMouseMove`, add at the top (before the `if (!drawStart)` check):

```typescript
  // Update hovered element for ancestry cycling in select mode
  if (isCapturing && currentMode === 'select') {
    const el = findNearestElement(e.clientX, e.clientY, document)
    if (el !== hoveredElement) {
      hoveredElement = el
      ancestryChain = el ? getAncestryChain(el) : []
      ancestryIndex = 0
      updateHighlight(el)
    }
  }
```

In `startCapture`, add the wheel listener:

```typescript
  document.addEventListener('wheel', handleWheel, { passive: false })
```

In `stopCapture`, clean up:

```typescript
  document.removeEventListener('wheel', handleWheel)
  hoveredElement = null
  ancestryChain = []
  ancestryIndex = 0
  updateHighlight(null)
```

- [ ] **Step 6: Run all tests**

Run: `bun test`

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/content/element-selector.ts src/content/index.ts tests/content/ancestry.test.ts
git commit -m "feat: add element ancestry cycling with Alt+scroll (#25)

Alt+scroll up selects parent, Alt+scroll down selects child. Visual
dashed outline shows current selection. Capped at 10 ancestors, skips
data-pointdev elements, stops at document.body.

Pattern from pi-annotate by Nico Bailon (MIT).

Closes #25

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Freehand + Rectangle Annotation Tools (#8)

**Closes:** GitHub issue #8

**Files:**
- Modify: `src/shared/types.ts` (add FreehandCoords, RectangleCoords)
- Modify: `src/shared/messages.ts` (extend CaptureMode)
- Modify: `src/content/canvas-overlay.ts` (add drawing methods)
- Modify: `src/content/index.ts` (handle new modes)
- Modify: `src/sidepanel/components/CaptureControls.tsx` (add buttons)
- Modify: `src/shared/formatter.ts` (format new types)
- Modify: `tests/content/canvas-overlay.test.ts` (add tests)
- Modify: `tests/shared/formatter.test.ts` (add tests)

- [ ] **Step 1: Add new coordinate types and extend AnnotationData**

In `src/shared/types.ts`, add after `ArrowCoords`:

```typescript
export interface FreehandCoords {
  points: Array<{ x: number; y: number }>
}

export interface RectangleCoords {
  x: number
  y: number
  width: number
  height: number
}
```

Update `AnnotationData`:

```typescript
export interface AnnotationData {
  type: 'circle' | 'arrow' | 'freehand' | 'rectangle'
  coordinates: CircleCoords | ArrowCoords | FreehandCoords | RectangleCoords
  timestampMs: number
  nearestElement?: string
  nearestElementContext?: {
    computedStyles: Record<string, string>
    boxModel?: BoxModel
    domSubtree: string
  }
}
```

- [ ] **Step 2: Extend CaptureMode**

In `src/shared/messages.ts`, change:

```typescript
export type CaptureMode = 'select' | 'circle' | 'arrow' | 'freehand' | 'rectangle'
```

- [ ] **Step 3: Write failing tests for canvas overlay**

First, update `createMockCanvas` in `tests/content/canvas-overlay.test.ts` to add `strokeRect`:

```typescript
// Add to the ctx object in createMockCanvas:
    strokeRect: vi.fn(),
```

Then add tests:

```typescript
  it('records rectangle annotation on draw complete', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, createMockWindow())
    overlay.setMode('rectangle')

    const annotation = overlay.completeAnnotation(
      { clientX: 100, clientY: 200 },
      { clientX: 250, clientY: 350 },
      1000, 2000
    )

    expect(annotation).toBeTruthy()
    expect(annotation!.type).toBe('rectangle')
    const coords = annotation!.coordinates as any
    expect(coords.width).toBe(150)
    expect(coords.height).toBe(150)
  })

  it('rejects rectangle smaller than 10px', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, createMockWindow())
    overlay.setMode('rectangle')

    const annotation = overlay.completeAnnotation(
      { clientX: 100, clientY: 200 },
      { clientX: 105, clientY: 205 },
      1000, 2000
    )
    expect(annotation).toBeNull()
  })

  it('records freehand annotation', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, createMockWindow())
    overlay.setMode('freehand')

    const points = [
      { clientX: 100, clientY: 200 },
      { clientX: 110, clientY: 210 },
      { clientX: 120, clientY: 220 },
      { clientX: 130, clientY: 230 },
    ]
    const annotation = overlay.completeFreehandAnnotation(points, 1000, 2000)

    expect(annotation).toBeTruthy()
    expect(annotation!.type).toBe('freehand')
    const coords = annotation!.coordinates as any
    expect(coords.points).toHaveLength(4)
  })

  it('rejects freehand with fewer than 3 points', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, createMockWindow())
    overlay.setMode('freehand')

    const annotation = overlay.completeFreehandAnnotation(
      [{ clientX: 100, clientY: 200 }, { clientX: 110, clientY: 210 }],
      1000, 2000
    )
    expect(annotation).toBeNull()
  })
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `bun test tests/content/canvas-overlay.test.ts`

Expected: FAIL — rectangle mode returns null from completeAnnotation, completeFreehandAnnotation doesn't exist.

- [ ] **Step 5: Implement rectangle and freehand in canvas-overlay.ts**

In `src/content/canvas-overlay.ts`, add to the stored annotation types:

```typescript
interface StoredFreehand { type: 'freehand'; points: Array<{ x: number; y: number }> }
interface StoredRectangle { type: 'rectangle'; x: number; y: number; w: number; h: number }
type StoredAnnotation = StoredCircle | StoredArrow | StoredFreehand | StoredRectangle
```

Update `currentPreview` type:

```typescript
private currentPreview:
  | { type: 'circle' | 'arrow' | 'rectangle'; start: Point; current: Point }
  | { type: 'freehand'; points: Point[] }
  | null = null
```

Add preview methods:

```typescript
  drawFreehandPreview(points: Point[]): void {
    this.currentPreview = { type: 'freehand', points }
    this.redraw()
  }

  drawRectanglePreview(start: Point, current: Point): void {
    this.currentPreview = { type: 'rectangle', start, current }
    this.redraw()
  }
```

Add `completeFreehandAnnotation`:

```typescript
  completeFreehandAnnotation(
    points: Point[],
    captureStartedAt: number,
    now: number
  ): AnnotationData | null {
    if (this.mode !== 'freehand' || points.length < 3) return null

    this.currentPreview = null
    const scrollX = this.win.scrollX
    const scrollY = this.win.scrollY
    const timestampMs = now - captureStartedAt

    const pagePoints = points.map(p => ({ x: p.clientX + scrollX, y: p.clientY + scrollY }))
    this.drawnAnnotations.push({ type: 'freehand', points: pagePoints })
    this.redraw()

    return {
      type: 'freehand' as const,
      coordinates: { points: pagePoints },
      timestampMs,
    }
  }
```

In the existing `completeAnnotation`, add a rectangle case after the arrow case:

```typescript
    if (this.mode === 'rectangle') {
      const x = Math.min(start.clientX, end.clientX)
      const y = Math.min(start.clientY, end.clientY)
      const w = Math.abs(end.clientX - start.clientX)
      const h = Math.abs(end.clientY - start.clientY)

      if (w < 10 && h < 10) return null

      this.drawnAnnotations.push({
        type: 'rectangle', x: x + scrollX, y: y + scrollY, w, h,
      })
      this.redraw()

      return {
        type: 'rectangle' as const,
        coordinates: { x: x + scrollX, y: y + scrollY, width: w, height: h },
        timestampMs,
      }
    }
```

Add private drawing methods:

```typescript
  private drawPolyline(points: Array<{ x: number; y: number }>): void {
    if (points.length < 2) return
    this.ctx.beginPath()
    this.ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y)
    }
    this.ctx.stroke()
  }

  private drawRect(x: number, y: number, w: number, h: number): void {
    this.ctx.beginPath()
    this.ctx.strokeRect(x, y, w, h)
  }
```

Update `redraw` to handle new types. Add in the annotation loop:

```typescript
      } else if (ann.type === 'freehand') {
        this.drawPolyline(ann.points.map(p => ({ x: p.x - sx, y: p.y - sy })))
      } else if (ann.type === 'rectangle') {
        this.drawRect(ann.x - sx, ann.y - sy, ann.w, ann.h)
      }
```

Update preview rendering in `redraw`:

```typescript
    if (this.currentPreview) {
      if (this.currentPreview.type === 'freehand') {
        this.drawPolyline(this.currentPreview.points.map(p => ({ x: p.clientX, y: p.clientY })))
      } else {
        const { type, start, current } = this.currentPreview
        if (type === 'circle') {
          this.drawEllipse(start.clientX, start.clientY,
            Math.abs(current.clientX - start.clientX), Math.abs(current.clientY - start.clientY))
        } else if (type === 'arrow') {
          this.drawArrow(start.clientX, start.clientY, current.clientX, current.clientY)
        } else if (type === 'rectangle') {
          const x = Math.min(start.clientX, current.clientX)
          const y = Math.min(start.clientY, current.clientY)
          this.drawRect(x, y, Math.abs(current.clientX - start.clientX), Math.abs(current.clientY - start.clientY))
        }
      }
    }
```

- [ ] **Step 6: Run canvas overlay tests**

Run: `bun test tests/content/canvas-overlay.test.ts`

Expected: All tests pass.

- [ ] **Step 7: Update content script mouse handlers**

In `src/content/index.ts`, add freehand state:

```typescript
let freehandPoints: Array<{ clientX: number; clientY: number }> = []
```

Update `handleMouseDown` to init freehand:

```typescript
function handleMouseDown(e: MouseEvent) {
  if (!isCapturing || currentMode === 'select' || !overlay) return
  drawStart = { clientX: e.clientX, clientY: e.clientY }
  if (currentMode === 'freehand') {
    freehandPoints = [{ clientX: e.clientX, clientY: e.clientY }]
  }
}
```

Update `handleMouseMove` to handle freehand and rectangle:

```typescript
function handleMouseMove(e: MouseEvent) {
  // ... ancestry tracking code (from Task 3) ...

  if (!drawStart || !overlay) return
  if (currentMode === 'circle') {
    overlay.drawCirclePreview(drawStart, { clientX: e.clientX, clientY: e.clientY })
  } else if (currentMode === 'arrow') {
    overlay.drawArrowPreview(drawStart, { clientX: e.clientX, clientY: e.clientY })
  } else if (currentMode === 'freehand') {
    // Throttle: skip points within 3px of the last one to avoid excessive accumulation
    const last = freehandPoints[freehandPoints.length - 1]
    if (!last || Math.abs(e.clientX - last.clientX) > 3 || Math.abs(e.clientY - last.clientY) > 3) {
      freehandPoints.push({ clientX: e.clientX, clientY: e.clientY })
    }
    overlay.drawFreehandPreview(freehandPoints)
  } else if (currentMode === 'rectangle') {
    overlay.drawRectanglePreview(drawStart, { clientX: e.clientX, clientY: e.clientY })
  }
}
```

Update `handleMouseUp` to handle freehand completion and focal points:

```typescript
function handleMouseUp(e: MouseEvent) {
  if (!drawStart || !overlay) return

  let annotation: AnnotationData | null = null

  if (currentMode === 'freehand') {
    annotation = overlay.completeFreehandAnnotation(freehandPoints, captureStartedAt, Date.now())
    freehandPoints = []
  } else {
    annotation = overlay.completeAnnotation(
      drawStart, { clientX: e.clientX, clientY: e.clientY },
      captureStartedAt, Date.now()
    )
  }

  drawStart = null

  if (annotation) {
    // Resolve focal point for nearestElement
    let viewportX: number, viewportY: number
    const coords = annotation.coordinates as any

    if (annotation.type === 'circle') {
      viewportX = coords.centerX - window.scrollX
      viewportY = coords.centerY - window.scrollY
    } else if (annotation.type === 'arrow') {
      viewportX = coords.endX - window.scrollX
      viewportY = coords.endY - window.scrollY
    } else if (annotation.type === 'freehand') {
      // Centroid of all points
      const pts = coords.points as Array<{ x: number; y: number }>
      const cx = pts.reduce((s: number, p: { x: number }) => s + p.x, 0) / pts.length
      const cy = pts.reduce((s: number, p: { y: number }) => s + p.y, 0) / pts.length
      viewportX = cx - window.scrollX
      viewportY = cy - window.scrollY
    } else {
      // Rectangle center
      viewportX = coords.x + coords.width / 2 - window.scrollX
      viewportY = coords.y + coords.height / 2 - window.scrollY
    }

    const nearestEl = findNearestElement(viewportX, viewportY, document)
    if (nearestEl && generateSelector) {
      annotation.nearestElement = generateSelector(nearestEl)
      const elData = extractElementData(
        nearestEl, annotation.nearestElement,
        window.getComputedStyle.bind(window),
        { scrollX: window.scrollX, scrollY: window.scrollY }
      )
      annotation.nearestElementContext = {
        computedStyles: elData.computedStyles,
        boxModel: elData.boxModel,
        domSubtree: elData.domSubtree,
      }
    }

    chrome.runtime.sendMessage({ type: 'ANNOTATION_ADDED', data: annotation })
  }
}
```

- [ ] **Step 8: Add mode buttons to CaptureControls**

In `src/sidepanel/components/CaptureControls.tsx`, add freehand and rectangle buttons after the arrow button:

```typescript
        <button
          className={`mode-btn ${mode === 'freehand' ? 'active' : ''}`}
          onClick={() => handleModeChange('freehand')}
          title="Freehand draw"
        >
          &#9998;
        </button>
        <button
          className={`mode-btn ${mode === 'rectangle' ? 'active' : ''}`}
          onClick={() => handleModeChange('rectangle')}
          title="Draw rectangle"
        >
          &#9633;
        </button>
```

- [ ] **Step 9: Add formatter support**

In `src/shared/formatter.ts`, add imports at the top:

```typescript
import type { CaptureSession, CircleCoords, ArrowCoords, FreehandCoords, RectangleCoords, BoxModel } from './types'
```

In `formatAnnotations`, add cases after the arrow case:

```typescript
    } else if (ann.type === 'freehand') {
      const f = ann.coordinates as FreehandCoords
      const xs = f.points.map(p => p.x)
      const ys = f.points.map(p => p.y)
      const w = Math.round(Math.max(...xs) - Math.min(...xs))
      const h = Math.round(Math.max(...ys) - Math.min(...ys))
      lines.push(`${i + 1}. [${ts}] Freehand around ${target} (${f.points.length} points, ~${w}x${h}px area)`)
    } else if (ann.type === 'rectangle') {
      const r = ann.coordinates as RectangleCoords
      lines.push(`${i + 1}. [${ts}] Rectangle over ${target} at (${r.x}, ${r.y}), ${r.width}x${r.height}px`)
    }
```

- [ ] **Step 10: Add formatter tests**

Add to `tests/shared/formatter.test.ts`:

```typescript
  it('formats freehand annotations', () => {
    const output = formatSession(makeSession({
      annotations: [{
        type: 'freehand',
        coordinates: {
          points: [
            { x: 100, y: 200 }, { x: 150, y: 210 }, { x: 200, y: 190 },
            { x: 250, y: 220 }, { x: 300, y: 200 },
          ],
        },
        timestampMs: 5000,
        nearestElement: 'button.submit',
      }],
    }))
    expect(output).toContain('Freehand around button.submit')
    expect(output).toContain('5 points')
  })

  it('formats rectangle annotations', () => {
    const output = formatSession(makeSession({
      annotations: [{
        type: 'rectangle',
        coordinates: { x: 100, y: 200, width: 300, height: 150 },
        timestampMs: 8000,
        nearestElement: 'div.card',
      }],
    }))
    expect(output).toContain('Rectangle over div.card')
    expect(output).toContain('300x150px')
  })
```

- [ ] **Step 11: Run all tests**

Run: `bun test`

Expected: All tests pass.

- [ ] **Step 12: Commit**

```bash
git add src/shared/types.ts src/shared/messages.ts src/content/canvas-overlay.ts src/content/index.ts src/sidepanel/components/CaptureControls.tsx src/shared/formatter.ts tests/content/canvas-overlay.test.ts tests/shared/formatter.test.ts
git commit -m "feat: add freehand and rectangle annotation tools (#8)

Extends the canvas overlay with freehand drawing (polyline) and rectangle
selection tools. Both follow the existing circle/arrow pattern: mouse
events, viewport preview, page-relative storage, scroll-aware redraw.

Closes #8

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Console Errors + Failed Network Requests (#11)

**Closes:** GitHub issue #11

**Files:**
- Create: `src/content/console-network-capture.ts`
- Modify: `src/shared/types.ts` (add ConsoleEntry, FailedRequest, extend CaptureSession)
- Modify: `src/shared/messages.ts` (add CONSOLE_BATCH)
- Modify: `src/content/index.ts` (start/stop capture)
- Modify: `src/background/service-worker.ts` (add to HANDLED_TYPES)
- Modify: `src/background/message-handler.ts` (handle CONSOLE_BATCH, inject main-world script)
- Modify: `src/background/session-store.ts` (add addConsoleBatch)
- Modify: `src/shared/formatter.ts` (add Console & Network section)
- Create: `tests/content/console-network-capture.test.ts`
- Modify: `tests/shared/formatter.test.ts`

- [ ] **Step 1: Add types to types.ts**

In `src/shared/types.ts`, add after `CursorSampleData`:

```typescript
export interface ConsoleEntry {
  level: 'error' | 'warn'
  message: string
  stack?: string
  timestampMs: number
}

export interface FailedRequest {
  method: string
  url: string
  status: number
  statusText: string
  timestampMs: number
}
```

Add to `CaptureSession` interface after `screenshots`:

```typescript
  consoleErrors: ConsoleEntry[]
  failedRequests: FailedRequest[]
```

Update `createEmptySession` to include:

```typescript
    consoleErrors: [],
    failedRequests: [],
```

- [ ] **Step 2: Add CONSOLE_BATCH message type**

In `src/shared/messages.ts`, add to the Message union under Content Script → Service Worker:

```typescript
  | { type: 'CONSOLE_BATCH'; data: { entries: ConsoleEntry[]; requests: FailedRequest[] } }
```

Add the import at the top:

```typescript
import type { SelectedElementData, AnnotationData, CursorSampleData, VoiceSegment, CaptureSession, ElementScreenshot, DeviceMetadata, ConsoleEntry, FailedRequest } from './types'
```

- [ ] **Step 3: Write failing test for ConsoleNetworkCapture**

Create `tests/content/console-network-capture.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsoleNetworkCapture } from '../../src/content/console-network-capture'

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn(),
    },
  })
})

describe('ConsoleNetworkCapture', () => {
  it('attaches DOM event listener on start', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const onBatch = vi.fn()
    const capture = new ConsoleNetworkCapture(Date.now(), onBatch)
    capture.start()

    expect(addSpy).toHaveBeenCalledWith('pointdev-console-batch', expect.any(Function))
    capture.stop()
    addSpy.mockRestore()
  })

  it('removes DOM event listener on stop', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const onBatch = vi.fn()
    const capture = new ConsoleNetworkCapture(Date.now(), onBatch)
    capture.start()
    capture.stop()

    expect(removeSpy).toHaveBeenCalledWith('pointdev-console-batch', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('calls onBatch when receiving CustomEvent', () => {
    const onBatch = vi.fn()
    const capture = new ConsoleNetworkCapture(Date.now(), onBatch)
    capture.start()

    const event = new CustomEvent('pointdev-console-batch', {
      detail: {
        entries: [{ level: 'error', message: 'test error', timestampMs: 500 }],
        requests: [{ method: 'GET', url: '/api/test', status: 404, statusText: 'Not Found', timestampMs: 600 }],
      },
    })
    document.dispatchEvent(event)

    expect(onBatch).toHaveBeenCalledWith(
      [{ level: 'error', message: 'test error', timestampMs: 500 }],
      [{ method: 'GET', url: '/api/test', status: 404, statusText: 'Not Found', timestampMs: 600 }],
    )

    capture.stop()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun test tests/content/console-network-capture.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 5: Implement ConsoleNetworkCapture**

Create `src/content/console-network-capture.ts`:

```typescript
import type { ConsoleEntry, FailedRequest } from '@shared/types'

type BatchCallback = (entries: ConsoleEntry[], requests: FailedRequest[]) => void

export class ConsoleNetworkCapture {
  private captureStartedAt: number
  private onBatch: BatchCallback
  private listener: ((e: Event) => void) | null = null

  constructor(captureStartedAt: number, onBatch: BatchCallback) {
    this.captureStartedAt = captureStartedAt
    this.onBatch = onBatch
  }

  start(): void {
    this.listener = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.entries || detail?.requests) {
        this.onBatch(detail.entries || [], detail.requests || [])
      }
    }
    document.addEventListener('pointdev-console-batch', this.listener)
  }

  stop(): void {
    if (this.listener) {
      document.removeEventListener('pointdev-console-batch', this.listener)
      this.listener = null
    }
    // Signal main-world script to stop
    document.dispatchEvent(new CustomEvent('pointdev-console-stop'))
  }
}

// NOTE: The main-world capture script is inlined in message-handler.ts as an argument
// to chrome.scripting.executeScript({ world: 'MAIN', func: ... }). It cannot be imported
// from this module because it runs in a different JS world. See message-handler.ts START_CAPTURE.
//
// The following is a REFERENCE COPY for documentation/testing purposes only — it is not
// called at runtime. The canonical version is the inline function in message-handler.ts.
export function mainWorldCaptureScript(captureStartedAt: number): void {
  const origConsoleError = console.error
  const origConsoleWarn = console.warn
  const origFetch = window.fetch
  const origXHRSend = XMLHttpRequest.prototype.send

  const entries: Array<{ level: string; message: string; stack?: string; timestampMs: number }> = []
  const requests: Array<{ method: string; url: string; status: number; statusText: string; timestampMs: number }> = []

  function ts() { return Date.now() - captureStartedAt }

  console.error = function (...args: any[]) {
    const msg = args.map(a => typeof a === 'string' ? a : String(a)).join(' ')
    const stack = new Error().stack?.split('\n').slice(2, 5).join('\n')
    entries.push({ level: 'error', message: msg.slice(0, 500), stack, timestampMs: ts() })
    return origConsoleError.apply(console, args)
  }

  console.warn = function (...args: any[]) {
    const msg = args.map(a => typeof a === 'string' ? a : String(a)).join(' ')
    entries.push({ level: 'warn', message: msg.slice(0, 500), timestampMs: ts() })
    return origConsoleWarn.apply(console, args)
  }

  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const method = init?.method || 'GET'
    const url = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).slice(0, 200)
    return origFetch.apply(window, [input, init as any]).then(
      (response: Response) => {
        if (!response.ok) {
          requests.push({ method, url, status: response.status, statusText: response.statusText, timestampMs: ts() })
        }
        return response
      },
      (err: Error) => {
        requests.push({ method, url, status: 0, statusText: err.message || 'Network error', timestampMs: ts() })
        throw err
      }
    )
  } as typeof fetch

  const origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
    (this as any).__pd_method = method;
    (this as any).__pd_url = String(url).slice(0, 200)
    return origOpen.apply(this, [method, url, ...rest] as any)
  }

  XMLHttpRequest.prototype.send = function (...args: any[]) {
    this.addEventListener('loadend', () => {
      if (this.status >= 400 || this.status === 0) {
        requests.push({
          method: (this as any).__pd_method || 'GET',
          url: (this as any).__pd_url || '',
          status: this.status,
          statusText: this.statusText || (this.status === 0 ? 'Network error' : ''),
          timestampMs: ts(),
        })
      }
    })
    return origXHRSend.apply(this, args)
  }

  window.addEventListener('error', (event) => {
    entries.push({
      level: 'error',
      message: (event.message || 'Uncaught error').slice(0, 500),
      stack: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      timestampMs: ts(),
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || event.reason?.toString() || 'Unhandled promise rejection'
    entries.push({
      level: 'error',
      message: msg.slice(0, 500),
      stack: event.reason?.stack?.split('\n').slice(0, 3).join('\n'),
      timestampMs: ts(),
    })
  })

  // Flush every 500ms
  const interval = setInterval(() => {
    if (entries.length > 0 || requests.length > 0) {
      document.dispatchEvent(new CustomEvent('pointdev-console-batch', {
        detail: { entries: entries.splice(0), requests: requests.splice(0) },
      }))
    }
  }, 500)

  // Listen for stop signal
  document.addEventListener('pointdev-console-stop', () => {
    console.error = origConsoleError
    console.warn = origConsoleWarn
    window.fetch = origFetch
    XMLHttpRequest.prototype.open = origOpen
    XMLHttpRequest.prototype.send = origXHRSend
    clearInterval(interval)
    // Final flush
    if (entries.length > 0 || requests.length > 0) {
      document.dispatchEvent(new CustomEvent('pointdev-console-batch', {
        detail: { entries: entries.splice(0), requests: requests.splice(0) },
      }))
    }
  }, { once: true })
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test tests/content/console-network-capture.test.ts`

Expected: All tests pass.

- [ ] **Step 7: Add addConsoleBatch to session-store.ts**

In `src/background/session-store.ts`, add import and method:

```typescript
import type { CaptureSession, SelectedElementData, AnnotationData, CursorSampleData, VoiceSegment, ElementScreenshot, DeviceMetadata, ConsoleEntry, FailedRequest } from '@shared/types'
```

Add method after `addScreenshot`:

```typescript
  addConsoleBatch(consoleBatch: ConsoleEntry[], requestBatch: FailedRequest[]): void {
    if (!this.session) return
    this.session.consoleErrors.push(...consoleBatch)
    this.session.failedRequests.push(...requestBatch)
    this.persist()
  }
```

- [ ] **Step 8: Handle CONSOLE_BATCH in message-handler.ts and inject main-world script**

In `src/background/message-handler.ts`, add the CONSOLE_BATCH case after SCREENSHOT_REQUEST:

```typescript
    case 'CONSOLE_BATCH': {
      store.addConsoleBatch(message.data.entries, message.data.requests)
      return undefined
    }
```

In the START_CAPTURE case, after the `INJECT_CAPTURE` message succeeds and the session is created, add main-world script injection:

```typescript
      // Inject console/network capture into the page's main world
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN' as any,
          func: (startedAt: number) => {
            // Inline the main-world capture logic
            // (imported version can't cross the world boundary)
            const origError = console.error, origWarn = console.warn
            const origFetch = window.fetch, origOpen = XMLHttpRequest.prototype.open
            const origSend = XMLHttpRequest.prototype.send
            const entries: any[] = [], requests: any[] = []
            const ts = () => Date.now() - startedAt

            console.error = function(...a: any[]) {
              entries.push({ level: 'error', message: a.map(String).join(' ').slice(0, 500), stack: new Error().stack?.split('\n').slice(2, 5).join('\n'), timestampMs: ts() })
              return origError.apply(console, a)
            }
            console.warn = function(...a: any[]) {
              entries.push({ level: 'warn', message: a.map(String).join(' ').slice(0, 500), timestampMs: ts() })
              return origWarn.apply(console, a)
            }
            window.fetch = function(input: any, init?: any) {
              const m = init?.method || 'GET', u = String(typeof input === 'string' ? input : input?.url || input).slice(0, 200)
              return origFetch.apply(window, [input, init]).then(
                (r: any) => { if (!r.ok) requests.push({ method: m, url: u, status: r.status, statusText: r.statusText, timestampMs: ts() }); return r },
                (e: any) => { requests.push({ method: m, url: u, status: 0, statusText: e.message || 'Network error', timestampMs: ts() }); throw e }
              )
            } as any
            XMLHttpRequest.prototype.open = function(m: string, u: any, ...r: any[]) { (this as any).__pd_m = m; (this as any).__pd_u = String(u).slice(0, 200); return origOpen.apply(this, [m, u, ...r] as any) }
            XMLHttpRequest.prototype.send = function(...a: any[]) {
              this.addEventListener('loadend', () => { if (this.status >= 400 || this.status === 0) requests.push({ method: (this as any).__pd_m || 'GET', url: (this as any).__pd_u || '', status: this.status, statusText: this.statusText || '', timestampMs: ts() }) })
              return origSend.apply(this, a)
            }
            window.addEventListener('error', (e) => { entries.push({ level: 'error', message: (e.message || 'Uncaught error').slice(0, 500), stack: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined, timestampMs: ts() }) })
            window.addEventListener('unhandledrejection', (e) => { entries.push({ level: 'error', message: (e.reason?.message || String(e.reason)).slice(0, 500), stack: e.reason?.stack?.split('\n').slice(0, 3).join('\n'), timestampMs: ts() }) })
            const iv = setInterval(() => { if (entries.length || requests.length) document.dispatchEvent(new CustomEvent('pointdev-console-batch', { detail: { entries: entries.splice(0), requests: requests.splice(0) } })) }, 500)
            document.addEventListener('pointdev-console-stop', () => { console.error = origError; console.warn = origWarn; window.fetch = origFetch; XMLHttpRequest.prototype.open = origOpen; XMLHttpRequest.prototype.send = origSend; clearInterval(iv); if (entries.length || requests.length) document.dispatchEvent(new CustomEvent('pointdev-console-batch', { detail: { entries: entries.splice(0), requests: requests.splice(0) } })) }, { once: true })
          },
          args: [Date.now()],
        })
      } catch {
        // Main-world injection failed (e.g., chrome:// pages) — continue without it
      }
```

- [ ] **Step 9: Add CONSOLE_BATCH to HANDLED_TYPES in service-worker.ts**

In `src/background/service-worker.ts`, add to the HANDLED_TYPES set:

```typescript
const HANDLED_TYPES = new Set([
  'START_CAPTURE', 'STOP_CAPTURE', 'SET_MODE',
  'TRANSCRIPT_UPDATE', 'ELEMENT_SELECTED', 'ANNOTATION_ADDED',
  'CURSOR_BATCH', 'DEVICE_METADATA', 'SCREENSHOT_REQUEST',
  'CONSOLE_BATCH',
])
```

- [ ] **Step 10: Wire up ConsoleNetworkCapture in content script**

In `src/content/index.ts`, add import:

```typescript
import { ConsoleNetworkCapture } from './console-network-capture'
```

Add module variable:

```typescript
let consoleCapture: ConsoleNetworkCapture | null = null
```

In `startCapture`, after cursorTracker.start:

```typescript
  consoleCapture = new ConsoleNetworkCapture(captureStartedAt, (entries, requests) => {
    chrome.runtime.sendMessage({ type: 'CONSOLE_BATCH', data: { entries, requests } })
  })
  consoleCapture.start()
```

In `stopCapture`, before the overlay cleanup:

```typescript
  if (consoleCapture) {
    consoleCapture.stop()
    consoleCapture = null
  }
```

- [ ] **Step 11: Add formatter section**

In `src/shared/formatter.ts`, add after the screenshots section check:

```typescript
  if (session.consoleErrors.length > 0 || session.failedRequests.length > 0) {
    sections.push(formatConsoleNetwork(session))
  }
```

Add the function:

```typescript
function formatConsoleNetwork(session: CaptureSession): string {
  const lines = ['## Console & Network']

  if (session.consoleErrors.length > 0) {
    lines.push('Errors:')
    for (const entry of session.consoleErrors) {
      const ts = formatTimestamp(entry.timestampMs)
      const prefix = entry.level === 'warn' ? 'Warning' : ''
      lines.push(`- [${ts}] ${prefix ? prefix + ': ' : ''}${entry.message}`)
      if (entry.stack) {
        lines.push(`    ${entry.stack.split('\n')[0]}`)
      }
    }
  }

  if (session.failedRequests.length > 0) {
    if (session.consoleErrors.length > 0) lines.push('')
    lines.push('Failed requests:')
    for (const req of session.failedRequests) {
      const ts = formatTimestamp(req.timestampMs)
      const statusStr = req.status === 0 ? '0 (network error)' : `${req.status} ${req.statusText}`
      lines.push(`- [${ts}] ${req.method} ${req.url} → ${statusStr}`)
    }
  }

  return lines.join('\n')
}
```

- [ ] **Step 12: Update formatter test helper and add tests**

In `tests/shared/formatter.test.ts`, update `makeSession` to include the new fields:

```typescript
function makeSession(overrides: Partial<CaptureSession> = {}): CaptureSession {
  return {
    id: 'test-1',
    tabId: 1,
    startedAt: 1000,
    url: 'https://example.com/page',
    title: 'Example Page',
    viewport: { width: 1200, height: 800 },
    device: null,
    selectedElement: null,
    voiceRecording: null,
    annotations: [],
    cursorTrace: [],
    screenshots: [],
    consoleErrors: [],
    failedRequests: [],
    ...overrides,
  }
}
```

Add tests:

```typescript
  it('formats console errors and failed requests', () => {
    const output = formatSession(makeSession({
      consoleErrors: [
        { level: 'error', message: 'TypeError: Cannot read property', stack: 'at Component.render (app.js:42)', timestampMs: 5000 },
        { level: 'warn', message: 'Deprecated API usage', timestampMs: 8000 },
      ],
      failedRequests: [
        { method: 'GET', url: '/api/users', status: 404, statusText: 'Not Found', timestampMs: 3000 },
      ],
    }))
    expect(output).toContain('## Console & Network')
    expect(output).toContain('TypeError: Cannot read property')
    expect(output).toContain('Warning: Deprecated API usage')
    expect(output).toContain('GET /api/users')
    expect(output).toContain('404 Not Found')
  })

  it('omits Console & Network section when empty', () => {
    const output = formatSession(makeSession())
    expect(output).not.toContain('## Console & Network')
  })
```

- [ ] **Step 13: Run all tests**

Run: `bun test`

Expected: All tests pass.

- [ ] **Step 14: Commit**

```bash
git add src/content/console-network-capture.ts src/shared/types.ts src/shared/messages.ts src/content/index.ts src/background/service-worker.ts src/background/message-handler.ts src/background/session-store.ts src/shared/formatter.ts tests/content/console-network-capture.test.ts tests/shared/formatter.test.ts
git commit -m "feat: capture console errors and failed network requests (#11)

Injects monkey-patching code into the page's main world to intercept
console.error/warn, fetch failures, XHR failures, uncaught exceptions,
and unhandled promise rejections. Data bridges back to the content script
via CustomEvent, then to the service worker via CONSOLE_BATCH message.

No new permissions required — uses existing 'scripting' permission with
world: 'MAIN'.

Closes #11

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Post-Implementation

After all 5 tasks are merged:

- [ ] **Run full test suite:** `bun test`
- [ ] **Run build:** `bun build`
- [ ] **Run lint:** `bun lint`
- [ ] **Close GitHub issues:** `gh issue close 15 26 25 8 11`
- [ ] **Update GenAI development log:** Append session entry to `docs/genai-disclosure/development-log.md`
