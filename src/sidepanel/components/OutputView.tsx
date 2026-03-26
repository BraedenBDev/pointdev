import { useMemo, useState } from 'react'
import type { CaptureSession } from '@shared/types'
import type { OutputFormat } from '@shared/types'
import { formatSession, formatSessionJSON, formatSessionMarkdown } from '@shared/formatter'
import { computeDwells, collapseDwells } from '@shared/dwell'
import { CopyButton } from './CopyButton'
import { ScreenshotThumbnail } from './ScreenshotThumbnail'

interface OutputViewProps {
  session: CaptureSession
  onBack: () => void
}

export function OutputView({ session, onBack }: OutputViewProps) {
  const [format, setFormat] = useState<OutputFormat>('text')

  const output = useMemo(() => {
    const sessionWithDwells = {
      ...session,
      cursorTrace: collapseDwells(computeDwells(session.cursorTrace)),
    }
    switch (format) {
      case 'json': return formatSessionJSON(sessionWithDwells)
      case 'markdown': return formatSessionMarkdown(sessionWithDwells)
      default: return formatSession(sessionWithDwells)
    }
  }, [session, format])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span className="header">PointDev</span>
        <button className="btn-back" onClick={onBack}>&#8592; Back</button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['text', 'json', 'markdown'] as OutputFormat[]).map(f => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            style={{
              padding: '3px 10px', fontSize: 11, borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', cursor: 'pointer',
              background: format === f ? 'var(--accent)' : 'var(--code-bg)',
              color: format === f ? '#fff' : 'var(--fg)',
            }}
          >
            {f === 'text' ? 'Text' : f === 'json' ? 'JSON' : 'Markdown'}
          </button>
        ))}
      </div>

      <div className="output-view">{output}</div>
      {session.screenshots.length > 0 && (
        <div style={{ marginTop: 12, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Screenshots</div>
          {session.screenshots.map((ss, i) => (
            <ScreenshotThumbnail key={i} screenshot={ss} size="large" />
          ))}
        </div>
      )}
      <CopyButton text={output} label={`Copy ${format === 'text' ? '' : format.toUpperCase() + ' '}to Clipboard`} />
    </div>
  )
}
