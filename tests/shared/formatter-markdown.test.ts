import { describe, it, expect } from 'vitest'
import { formatSessionMarkdown } from '../../src/shared/formatter'
import { createEmptySession } from '../../src/shared/types'

describe('formatSessionMarkdown', () => {
  it('starts with H1 title', () => {
    const session = createEmptySession('test', 1, 'https://example.com', 'Test', { width: 1440, height: 900 })
    const md = formatSessionMarkdown(session)
    expect(md).toMatch(/^# PointDev Capture/)
  })

  it('wraps existing formatSession output with markdown frontmatter', () => {
    const session = createEmptySession('test', 1, 'https://example.com', 'Test', { width: 1440, height: 900 })
    const md = formatSessionMarkdown(session)
    expect(md).toContain('## Context')
    expect(md).toContain('https://example.com')
  })

  function withScreenshot() {
    return {
      ...createEmptySession('test', 1, 'https://example.com', 'Test', { width: 1440, height: 900 }),
      screenshots: [{
        dataUrl: 'data:image/png;base64,abc',
        timestampMs: 3000,
        viewport: { scrollX: 0, scrollY: 0 },
        annotationIndices: [],
        descriptionParts: ['Auto-captured'],
        trigger: 'voice' as const,
        interestScore: 0.7,
      }],
    }
  }

  it('links screenshots to the saved image files', () => {
    const md = formatSessionMarkdown(withScreenshot(), ['pointdev-example.com-1.png'])
    expect(md).toContain('![Screenshot 1](pointdev-example.com-1.png)')
    expect(md).toContain('*[00:03] Auto-captured*')
    expect(md).toContain('\n\n---\n')
  })

  it('emits no image links when no files are saved (copied Markdown)', () => {
    const md = formatSessionMarkdown(withScreenshot())
    expect(md).not.toContain('![')
    expect(md).toContain('## Screenshots')
  })

  it('falls back to the host when the page has no title', () => {
    const session = createEmptySession('test', 1, 'https://example.com/a/b', '', { width: 1440, height: 900 })
    expect(formatSessionMarkdown(session)).toMatch(/^# PointDev Capture — example\.com\n/)
  })
})
