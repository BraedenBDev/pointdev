import { describe, it, expect, vi, afterEach } from 'vitest'
import { exportFileNames, downloadMarkdownBundle } from '../../../src/sidepanel/lib/markdown-export'
import { createEmptySession } from '@shared/types'

function makeSession() {
  const session = createEmptySession('t', 1, 'https://guri.vercel.app/page.html', '', { width: 1200, height: 800 })
  session.startedAt = Date.UTC(2026, 8, 25, 22, 19, 54)
  const shot = { timestampMs: 1000, viewport: { scrollX: 0, scrollY: 0 }, annotationIndices: [], descriptionParts: ['x'] }
  session.screenshots = [
    { ...shot, dataUrl: 'data:image/png;base64,AAA' },
    { ...shot, dataUrl: '' },
    { ...shot, dataUrl: 'data:image/jpeg;base64,BBB' },
  ]
  return session
}

describe('markdown export', () => {
  afterEach(() => vi.restoreAllMocks())

  it('names the .md and images with a shared prefix and the real image type', () => {
    expect(exportFileNames(makeSession())).toEqual({
      markdown: 'pointdev-guri.vercel.app-2026-09-25-221954.md',
      images: [
        'pointdev-guri.vercel.app-2026-09-25-221954-1.png',
        undefined,
        'pointdev-guri.vercel.app-2026-09-25-221954-3.jpg',
      ],
    })
  })

  it('downloads the .md plus every screenshot that has image data', () => {
    URL.createObjectURL = vi.fn(() => 'blob:md')
    URL.revokeObjectURL = vi.fn()
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })
    downloadMarkdownBundle(makeSession())
    expect(names).toEqual([
      'pointdev-guri.vercel.app-2026-09-25-221954.md',
      'pointdev-guri.vercel.app-2026-09-25-221954-1.png',
      'pointdev-guri.vercel.app-2026-09-25-221954-3.jpg',
    ])
  })
})
