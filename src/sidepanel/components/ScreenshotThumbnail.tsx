import { useState, useCallback } from 'react'
import type { AnnotatedScreenshot } from '@shared/types'

interface ScreenshotThumbnailProps {
  screenshot: AnnotatedScreenshot
  size: 'small' | 'large'
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
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
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: copy description text
      await navigator.clipboard.writeText(
        screenshot.descriptionParts.join(' | ') + (screenshot.voiceContext ? ` — "${screenshot.voiceContext}"` : '')
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
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
        <span style={{ color: 'var(--muted)' }}>[{ts}]</span> {desc}
      </div>
      {screenshot.voiceContext && (
        <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--muted)' }}>
          "{screenshot.voiceContext}"
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
