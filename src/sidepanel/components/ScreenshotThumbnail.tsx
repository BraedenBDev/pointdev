import { useState, useCallback } from 'react'
import type { AnnotatedScreenshot } from '@shared/types'
import { formatTimestamp } from '@shared/formatter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ScreenshotThumbnailProps {
  screenshot: AnnotatedScreenshot
  size: 'small' | 'large'
}

export function ScreenshotThumbnail({ screenshot, size }: ScreenshotThumbnailProps) {
  const [copied, setCopied] = useState(false)
  const width = size === 'small' ? 120 : 240

  const handleCopy = useCallback(async () => {
    if (!screenshot.dataUrl) return
    try {
      const response = await fetch(screenshot.dataUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
    } catch {
      const desc = screenshot.descriptionParts.join(' | ')
      const voice = screenshot.voiceContext ? ` — "${screenshot.voiceContext}"` : ''
      await navigator.clipboard.writeText(desc + voice)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [screenshot])

  const desc = screenshot.descriptionParts.join(' | ')
  const ts = formatTimestamp(screenshot.timestampMs)

  return (
    <div className="mb-2">
      {screenshot.dataUrl ? (
        <img
          src={screenshot.dataUrl}
          alt={desc}
          style={{ width }}
          className="rounded-md border border-outline"
        />
      ) : (
        <div
          style={{ width, height: width * 0.6 }}
          className="bg-surface-variant rounded-md flex items-center justify-center text-[11px] text-muted"
        >
          Screenshot lost
        </div>
      )}
      <div className="text-[11px] mt-1 flex items-center gap-1 flex-wrap">
        <span className="text-muted">[{ts}]</span>
        {screenshot.trigger && (
          <Badge variant={screenshot.trigger as any}>
            {screenshot.trigger}
          </Badge>
        )}
        <span className="text-on-surface-variant">{desc}</span>
      </div>
      {screenshot.voiceContext && (
        <div className="text-[11px] italic text-muted">
          &ldquo;{screenshot.voiceContext}&rdquo;
        </div>
      )}
      {screenshot.signals && size === 'large' && (
        <div className="text-[10px] text-muted mt-0.5">
          {screenshot.signals.frameDiffRatio != null && `${Math.round(screenshot.signals.frameDiffRatio * 100)}% visual change`}
          {screenshot.signals.dwellElement && ` | dwell: ${screenshot.signals.dwellElement}`}
          {screenshot.interestScore != null && ` | score: ${screenshot.interestScore}`}
        </div>
      )}
      {size === 'large' && (
        <Button variant="tonal" size="sm" onClick={handleCopy} className="mt-1">
          {copied ? 'Copied!' : 'Copy Image'}
        </Button>
      )}
    </div>
  )
}
