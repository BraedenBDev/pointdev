import { useMemo, useState } from 'react'
import type { CaptureSession, OutputFormat } from '@shared/types'
import { formatSession, formatSessionJSON, formatSessionMarkdown } from '@shared/formatter'
import { computeDwells, collapseDwells } from '@shared/dwell'
import { AppHeader } from '@/components/ui/app-header'
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
  const [copied, setCopied] = useState(false)

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
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const durationMs = session.cursorTrace.length > 0
    ? session.cursorTrace[session.cursorTrace.length - 1].timestampMs
    : 0
  const durationSec = Math.round(durationMs / 1000)

  return (
    <div className="flex flex-col gap-4">
      <AppHeader
        title="Capture Complete"
        subtitle={`${session.url.replace(/^https?:\/\//, '').split('/')[0]} · ${durationSec}s · ${session.voiceRecording?.segments.length ?? 0} segments`}
      />

      <div className="h-px bg-outline/60" />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="py-3 px-3 bg-surface-variant/50 border border-outline/40 rounded-xl text-center">
          <div className="text-xl font-semibold text-on-surface leading-tight">{session.annotations.length}</div>
          <div className="text-xs text-muted mt-1">Annotations</div>
        </div>
        <div className="py-3 px-3 bg-surface-variant/50 border border-outline/40 rounded-xl text-center">
          <div className="text-xl font-semibold text-on-surface leading-tight">{session.screenshots.length}</div>
          <div className="text-xs text-muted mt-1">Screenshots</div>
        </div>
        <div className="py-3 px-3 bg-surface-variant/50 border border-outline/40 rounded-xl text-center">
          <div className="text-xl font-semibold text-on-surface leading-tight">{session.voiceRecording?.segments.length ?? 0}</div>
          <div className="text-xs text-muted mt-1">Voice seg.</div>
        </div>
      </div>

      {/* Format tabs */}
      <SegmentedButton
        options={formatOptions}
        value={format}
        onChange={(v) => setFormat(v as OutputFormat)}
      />

      {/* Output code block */}
      <ScrollArea className="max-h-[320px]">
        <pre className="bg-code-bg text-code-text font-mono text-xs leading-relaxed p-4 pr-6 rounded-xl whitespace-pre-wrap break-words">
          {output}
        </pre>
      </ScrollArea>

      {/* Screenshots — 2-col grid */}
      {session.screenshots.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Screenshots
          </div>
          <div className="grid grid-cols-2 gap-3">
            {session.screenshots.map((ss, i) => (
              <ScreenshotThumbnail key={i} screenshot={ss} />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="full" onClick={handleCopy}>
          {copied ? 'Copied!' : `Copy ${format === 'text' ? '' : format.toUpperCase() + ' '}to Clipboard`}
        </Button>
        <Button variant="outline" onClick={onBack} className="shrink-0 px-5">
          New
        </Button>
      </div>

      <div className="text-xs text-muted pb-1">
        Tip: Run <code className="font-mono text-primary bg-primary-container/50 rounded px-1">npx @pointdev/bridge</code> to stream sessions to AI tools via MCP
      </div>
    </div>
  )
}
