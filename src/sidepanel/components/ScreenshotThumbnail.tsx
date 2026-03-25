import { useState, useCallback } from 'react'
import type { AnnotatedScreenshot } from '@shared/types'
import { formatTimestamp } from '@shared/formatter'

interface ScreenshotThumbnailProps {
  screenshot: AnnotatedScreenshot
  size: 'small' | 'large'
}

function triggerColor(trigger: string): string {
  switch (trigger) {
    case 'voice': return '#8b5cf6'
    case 'frame-diff': return '#3b82f6'
    case 'dwell': return '#f59e0b'
    case 'annotation': return '#22c55e'
    case 'multi': return '#ec4899'
    default: return '#6b7280'
  }
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
      // Fallback: copy description text
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
    <div className="screenshot-thumbnail" style={{ marginBottom: 8 }}>
      {screenshot.dataUrl ? (
        <img
          src={screenshot.dataUrl}
          alt={desc}
          style={{ width, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
        />
      ) : (
        <div style={{ width, height: width * 0.6, background: 'var(--code-bg)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--muted)' }}>
          Screenshot lost
        </div>
      )}
      <div style={{ fontSize: 11, marginTop: 4 }}>
        <span style={{ color: 'var(--muted)' }}>[{ts}]</span>
        {screenshot.trigger && (
          <span style={{
            marginLeft: 4, padding: '1px 5px', borderRadius: 3, fontSize: 10,
            background: triggerColor(screenshot.trigger), color: '#fff',
          }}>
            {screenshot.trigger}
          </span>
        )}
        {' '}{desc}
      </div>
      {screenshot.voiceContext && (
        <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--muted)' }}>
          "{screenshot.voiceContext}"
        </div>
      )}
      {screenshot.signals && size === 'large' && (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
          {screenshot.signals.frameDiffRatio != null && `${Math.round(screenshot.signals.frameDiffRatio * 100)}% visual change`}
          {screenshot.signals.dwellElement && ` | dwell: ${screenshot.signals.dwellElement}`}
          {screenshot.interestScore != null && ` | score: ${screenshot.interestScore}`}
        </div>
      )}
      {size === 'large' && (
        <button
          className="btn-copy-img"
          onClick={handleCopy}
          style={{
            marginTop: 4, padding: '4px 8px', fontSize: 11,
            background: 'var(--accent)', color: 'white', border: 'none',
            borderRadius: 'var(--radius)', cursor: 'pointer',
          }}
        >
          {copied ? 'Copied!' : 'Copy Image'}
        </button>
      )}
    </div>
  )
}
