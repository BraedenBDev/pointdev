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
  // Bind the mic permission action into the permission rows
  const enrichedPermissions = permissions.map(p => {
    if (p.name === 'Microphone' && p.status === 'error') {
      return { ...p, onAction: onRequestMic }
    }
    return p
  })

  return (
    <div className="flex flex-col gap-3">
      <AppHeader subtitle="v0.2.0" />

      {/* Divider */}
      <div className="h-px bg-outline" />

      {/* Voice Engine */}
      <div>
        <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">
          Voice Engine
        </div>
        <SegmentedButton
          options={engineOptions}
          value={engine}
          onChange={(v) => onEngineChange(v as SpeechEngine)}
        />
        <div className="text-[10px] text-muted mt-1.5">
          {engineDescriptions[engine]}
        </div>
      </div>

      {/* Status */}
      <div>
        <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">
          Status
        </div>
        <div className="flex flex-col gap-1">
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
        <div className="text-[10px] text-error leading-relaxed">
          Cannot capture on this page. Navigate to a regular webpage.
        </div>
      )}
      {canCapture && !micGranted && (
        <div className="text-[10px] text-warning leading-relaxed">
          Voice narration unavailable — mic access needed. Capture will work without voice.
        </div>
      )}
    </div>
  )
}
