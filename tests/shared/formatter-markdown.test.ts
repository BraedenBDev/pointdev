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

  it('includes screenshot references as image placeholders', () => {
    const session = {
      ...createEmptySession('test', 1, 'https://example.com', 'Test', { width: 1440, height: 900 }),
      screenshots: [{
        dataUrl: 'data:image/jpeg;base64,abc',
        timestampMs: 3000,
        viewport: { scrollX: 0, scrollY: 0 },
        annotationIndices: [],
        descriptionParts: ['Auto-captured'],
        trigger: 'voice' as const,
        interestScore: 0.7,
      }],
    }
    const md = formatSessionMarkdown(session)
    expect(md).toContain('![Screenshot 1]')
  })
})
