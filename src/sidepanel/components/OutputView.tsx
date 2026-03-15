import { useMemo } from 'react'
import type { CaptureSession } from '@shared/types'
import { formatSession } from '@shared/formatter'
import { computeDwells } from '@shared/dwell'
import { CopyButton } from './CopyButton'

interface OutputViewProps {
  session: CaptureSession
  onBack: () => void
}

export function OutputView({ session, onBack }: OutputViewProps) {
  const output = useMemo(() => {
    const sessionWithDwells = {
      ...session,
      cursorTrace: computeDwells(session.cursorTrace),
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
      <CopyButton text={output} />
    </div>
  )
}
