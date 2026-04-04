import type { AnnotatedScreenshot } from '@shared/types'
import { formatTimestamp } from '@shared/formatter'
import { Badge } from '@/components/ui/badge'

interface ScreenshotThumbnailProps {
  screenshot: AnnotatedScreenshot
}

export function ScreenshotThumbnail({ screenshot }: ScreenshotThumbnailProps) {
  const desc = screenshot.descriptionParts.join(' | ')
  const ts = formatTimestamp(screenshot.timestampMs)

  return (
    <div>
      {screenshot.dataUrl ? (
        <img
          src={screenshot.dataUrl}
          alt={desc}
          loading="lazy"
          className="w-full aspect-video object-contain rounded-lg border border-outline bg-surface-variant"
        />
      ) : (
        <div className="w-full aspect-video bg-surface-variant rounded-lg flex items-center justify-center text-xs text-muted">
          Screenshot lost
        </div>
      )}
      <div className="text-xs mt-1.5 flex items-center gap-1 flex-wrap">
        <span className="text-muted">[{ts}]</span>
        {screenshot.trigger && (
          <Badge variant={screenshot.trigger as any}>
            {screenshot.trigger}
          </Badge>
        )}
      </div>
      <div className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{desc}</div>
      {screenshot.voiceContext && (
        <div className="text-xs italic text-muted mt-0.5">
          &ldquo;{screenshot.voiceContext}&rdquo;
        </div>
      )}
    </div>
  )
}
