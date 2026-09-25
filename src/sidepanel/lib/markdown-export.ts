import type { CaptureSession } from '@shared/types'
import { formatSessionMarkdown } from '@shared/formatter'

/** File names shared by the .md and its screenshots, so the image links resolve side by side. */
export function exportFileNames(session: CaptureSession): { markdown: string; images: (string | undefined)[] } {
  const host = session.url.replace(/^https?:\/\//, '').split('/')[0].replace(/[^\w.-]/g, '_')
  const stamp = new Date(session.startedAt).toISOString().slice(0, 19).replace(/:/g, '').replace('T', '-')
  const base = `pointdev-${host}-${stamp}`
  return {
    markdown: `${base}.md`,
    // Full screenshots are PNG (captureVisibleTab default); read the real type from the data URL
    images: session.screenshots.map((s, i) =>
      s.dataUrl ? `${base}-${i + 1}.${s.dataUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png'}` : undefined),
  }
}

function download(url: string, name: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
}

/**
 * Saves the Markdown and every screenshot into the Downloads folder under matching names.
 * Chrome asks once to allow this extension to download multiple files.
 */
export function downloadMarkdownBundle(session: CaptureSession): void {
  const names = exportFileNames(session)
  const mdUrl = URL.createObjectURL(new Blob([formatSessionMarkdown(session, names.images)], { type: 'text/markdown' }))
  download(mdUrl, names.markdown)
  setTimeout(() => URL.revokeObjectURL(mdUrl), 1000)
  session.screenshots.forEach((s, i) => {
    const name = names.images[i]
    if (name) download(s.dataUrl, name)
  })
}
