import { useMemo } from 'react'
import type { CaptureSession } from '@shared/types'
import { formatSession } from '@shared/formatter'
import { computeDwells, collapseDwells } from '@shared/dwell'
import { CopyButton } from './CopyButton'
import { ScreenshotThumbnail } from './ScreenshotThumbnail'

interface OutputViewProps {
  session: CaptureSession
  onBack: () => void
}

export function OutputView({ session, onBack }: OutputViewProps) {
  const output = useMemo(() => {
    const sessionWithDwells = {
      ...session,
      cursorTrace: collapseDwells(computeDwells(session.cursorTrace)),
    }
    return formatSession(sessionWithDwells)
  }, [session])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span className="header">PointDev</span>
        <button className="btn-back" onClick={onBack}>&#8592; Back</button>
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
      <CopyButton text={output} />
    </div>
  )
}
