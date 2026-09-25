import { describe, it, expect } from 'vitest'
import { buildReportHtml } from '../../../src/sidepanel/lib/pdf-report'
import { createEmptySession } from '@shared/types'

function makeSession() {
  const session = createEmptySession('t', 1, 'https://example.com/page', 'Example', { width: 1200, height: 800 })
  session.screenshots = [
    { dataUrl: 'data:image/png;base64,AAA', timestampMs: 5000, viewport: { scrollX: 0, scrollY: 0 }, annotationIndices: [], descriptionParts: ['Voice narration active'], trigger: 'voice', voiceContext: 'these are broken' },
    { dataUrl: '', timestampMs: 9000, viewport: { scrollX: 0, scrollY: 0 }, annotationIndices: [], descriptionParts: ['Page capture'] },
  ]
  return session
}

describe('buildReportHtml', () => {
  it('includes the prompt text and every screenshot with its caption', () => {
    const html = buildReportHtml(makeSession(), '## Context\n- URL: https://example.com/page')
    expect(html).toContain('## Context')
    expect(html).toContain('<img src="data:image/png;base64,AAA"')
    expect(html).toContain('1. [00:05] · voice · Voice narration active')
    expect(html).toContain('these are broken')
    expect(html).toContain('Screenshot lost')
    expect(html).toContain('<title>PointDev capture - example.com - ')
  })

  it('escapes page-derived text so it cannot inject markup', () => {
    const session = makeSession()
    session.screenshots[0].descriptionParts = ['Selected <img src=x onerror=alert(1)>']
    const html = buildReportHtml(session, '<script>alert(1)</script>')
    expect(html).not.toContain('<script>alert(1)')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
  })
})
