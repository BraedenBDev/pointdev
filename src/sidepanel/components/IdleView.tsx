import { AppHeader } from '@/components/ui/app-header'
import { Button } from '@/components/ui/button'
import { SegmentedButton } from '@/components/ui/segmented-button'
import { PermissionRow, type PermissionRowProps } from '@/components/ui/permission-row'

type SpeechEngine = 'web-speech' | 'whisper'

interface IdleViewProps {
  engine: SpeechEngine
  onEngineChange: (engine: SpeechEngine) => void
  permissions: PermissionRowProps[]
  canCapture: boolean
  micGranted: boolean
  onStart: () => void
  onRequestMic: () => void
}

const engineOptions = [
  { value: 'web-speech', label: '⚡ Fast' },
  { value: 'whisper', label: '🔒 Private' },
]

const engineDescriptions: Record<SpeechEngine, string> = {
  'web-speech': 'Google Speech API · Low latency · Requires internet',
  'whisper': 'On-device Whisper · Private · Downloads ~40MB model',
}

export function IdleView({ engine, onEngineChange, permissions, canCapture, micGranted, onStart, onRequestMic }: IdleViewProps) {
  const enrichedPermissions = permissions.map(p => {
    if (p.name === 'Microphone' && p.status === 'error') {
      return { ...p, onAction: onRequestMic }
    }
    return p
  })

  return (
    <div className="flex flex-col gap-4">
      <AppHeader subtitle="v0.2.0" />

      <div className="h-px bg-outline/60" />

      {/* Voice Engine */}
      <div className="bg-surface-variant/50 rounded-xl p-4">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          Voice Engine
        </div>
        <SegmentedButton
          options={engineOptions}
          value={engine}
          onChange={(v) => onEngineChange(v as SpeechEngine)}
        />
        <div className="text-xs text-muted mt-2 leading-relaxed">
          {engineDescriptions[engine]}
        </div>
      </div>

      {/* Status */}
      <div>
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          Status
        </div>
        <div className="flex flex-col gap-1.5">
          {enrichedPermissions.map((perm) => (
            <PermissionRow key={perm.name} {...perm} />
          ))}
        </div>
      </div>

      {/* Start button */}
      <Button
        size="full"
        onClick={onStart}
        disabled={!canCapture}
      >
        Start Capture
      </Button>

      {/* Warnings */}
      {!canCapture && (
        <div className="text-xs text-error leading-relaxed -mt-2">
          Cannot capture on this page. Navigate to a regular webpage.
        </div>
      )}
      {canCapture && !micGranted && (
        <div className="text-xs text-on-surface leading-relaxed bg-warning/10 rounded-lg px-3 py-2 -mt-2">
          Voice narration unavailable — mic access needed.
        </div>
      )}

      <div className="text-xs text-muted leading-relaxed">
        Talk, draw, and click on the page to capture structured context for your AI coding tool.
      </div>
    </div>
  )
}
