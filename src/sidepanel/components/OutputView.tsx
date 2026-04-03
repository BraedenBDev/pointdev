import { useMemo, useState } from 'react'
import type { CaptureSession, OutputFormat } from '@shared/types'
import { formatSession, formatSessionJSON, formatSessionMarkdown } from '@shared/formatter'
import { computeDwells, collapseDwells } from '@shared/dwell'
import { Button } from '@/components/ui/button'
import { SegmentedButton } from '@/components/ui/segmented-button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ScreenshotThumbnail } from './ScreenshotThumbnail'

const formatOptions = [
  { value: 'text', label: 'Text' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
]

interface OutputViewProps {
  session: CaptureSession
  onBack: () => void
}

export function OutputView({ session, onBack }: OutputViewProps) {
  const [format, setFormat] = useState<OutputFormat>('text')

  const sessionWithDwells = useMemo(() => ({
    ...session,
    cursorTrace: collapseDwells(computeDwells(session.cursorTrace)),
  }), [session])

  const output = useMemo(() => {
    switch (format) {
      case 'json': return formatSessionJSON(sessionWithDwells)
      case 'markdown': return formatSessionMarkdown(sessionWithDwells)
      default: return formatSession(sessionWithDwells)
    }
  }, [sessionWithDwells, format])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = output
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  }

  const durationMs = session.cursorTrace.length > 0
    ? session.cursorTrace[session.cursorTrace.length - 1].timestampMs
    : 0
  const durationSec = Math.round(durationMs / 1000)

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-on-primary text-xs font-bold">
          P
        </div>
        <div>
          <div className="text-[15px] font-semibold text-on-surface">Capture Complete</div>
          <div className="text-[10px] text-muted">
            {session.url.replace(/^https?:\/\//, '').split('/')[0]} · {durationSec}s · {session.voiceRecording?.segments.length ?? 0} segments
          </div>
        </div>
      </div>

      <div className="h-px bg-outline" />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="p-2 bg-surface border border-outline rounded-md text-center">
          <div className="text-base font-semibold text-on-surface">{session.annotations.length}</div>
          <div className="text-[9px] text-muted">Annotations</div>
        </div>
        <div className="p-2 bg-surface border border-outline rounded-md text-center">
          <div className="text-base font-semibold text-on-surface">{session.screenshots.length}</div>
          <div className="text-[9px] text-muted">Screenshots</div>
        </div>
        <div className="p-2 bg-surface border border-outline rounded-md text-center">
          <div className="text-base font-semibold text-on-surface">{session.voiceRecording?.segments.length ?? 0}</div>
          <div className="text-[9px] text-muted">Voice seg.</div>
        </div>
      </div>

      {/* Format tabs */}
      <SegmentedButton
        options={formatOptions}
        value={format}
        onChange={(v) => setFormat(v as OutputFormat)}
      />

      {/* Output code block */}
      <ScrollArea className="max-h-[40vh]">
        <pre className="bg-code-bg text-[#a7f3d0] font-mono text-[10px] leading-relaxed p-3 rounded-md whitespace-pre-wrap break-words">
          {output}
        </pre>
      </ScrollArea>

      {/* Screenshots */}
      {session.screenshots.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1.5">
            Screenshots
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2">
            {session.screenshots.map((ss, i) => (
              <ScreenshotThumbnail key={i} screenshot={ss} size="small" />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5">
        <Button size="full" onClick={handleCopy}>
          Copy {format === 'text' ? '' : format.toUpperCase() + ' '}to Clipboard
        </Button>
        <Button variant="outline" onClick={onBack} className="shrink-0">
          New
        </Button>
      </div>

      <div className="text-[10px] text-muted">
        Tip: Run <code className="font-mono text-primary">npx @pointdev/bridge</code> to stream sessions to AI tools via MCP
      </div>
    </div>
  )
}
