import type { CaptureSession } from '@shared/types'
import { formatTimestamp } from '@shared/formatter'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Printable HTML report: the full text prompt followed by every screenshot at full width. */
export function buildReportHtml(session: CaptureSession, promptText: string): string {
  const host = session.url.replace(/^https?:\/\//, '').split('/')[0]
  const date = new Date(session.startedAt).toISOString().slice(0, 10)

  const screenshots = session.screenshots.map((s, i) => {
    const caption = [`${i + 1}. [${formatTimestamp(s.timestampMs)}]`, s.trigger, s.descriptionParts.join(' | ')]
      .filter(Boolean).join(' · ')
    return `<figure>
  ${s.dataUrl ? `<img src="${escapeHtml(s.dataUrl)}" alt="${escapeHtml(caption)}">` : '<div class="lost">Screenshot lost</div>'}
  <figcaption>${escapeHtml(caption)}${s.voiceContext ? `<br><i>“${escapeHtml(s.voiceContext)}”</i>` : ''}</figcaption>
</figure>`
  }).join('\n')

  // The title becomes Chrome's default "Save as PDF" file name
  return `<!doctype html>
<html><head><meta charset="utf-8">
<title>PointDev capture - ${escapeHtml(host)} - ${date}</title>
<style>
  body { font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: #1a1a1a; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 16px; }
  h2 { font-size: 15px; margin: 24px 0 12px; }
  pre { font: 12px/1.5 ui-monospace, Menlo, monospace; white-space: pre-wrap; word-break: break-word; background: #f5f5f4; padding: 16px; border-radius: 8px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  figure { margin: 0 0 20px; break-inside: avoid; }
  img { width: 100%; border: 1px solid #ddd; border-radius: 6px; }
  figcaption { font-size: 12px; color: #555; margin-top: 6px; }
  .lost { padding: 32px; text-align: center; background: #f5f5f4; color: #777; }
  @page { margin: 12mm; }
</style></head>
<body>
<h1>PointDev capture — ${escapeHtml(host)}</h1>
<pre>${escapeHtml(promptText)}</pre>
${session.screenshots.length ? `<h2>Screenshots (${session.screenshots.length})</h2>\n${screenshots}` : ''}
</body></html>`
}

/** Opens the report in a new tab and shows Chrome's print dialog, where "Save as PDF" produces the file. */
export async function exportPdf(session: CaptureSession, promptText: string): Promise<void> {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(buildReportHtml(session, promptText))
  win.document.close()
  // Wait for the full-size screenshots to decode so they aren't blank in the PDF
  await Promise.all(Array.from(win.document.images).map(img => img.decode().catch(() => {})))
  win.focus()
  win.print()
}
