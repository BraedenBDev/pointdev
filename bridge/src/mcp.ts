type GetSession = () => Record<string, any> | null

interface ToolResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>
}

function text(msg: string): ToolResult {
  return { content: [{ type: 'text', text: msg }] }
}

function json(data: unknown): ToolResult {
  return text(JSON.stringify(data, null, 2))
}

export function buildMcpToolHandlers(getSession: GetSession) {
  return {
    get_session(): ToolResult {
      const session = getSession()
      if (!session) return text('No active capture session.')
      const { screenshots, ...rest } = session
      return json({
        ...rest,
        screenshots: (screenshots || []).map((s: any) => {
          const { dataUrl, ...meta } = s
          return meta
        }),
      })
    },

    get_voice_transcript(): ToolResult {
      const session = getSession()
      if (!session?.voiceRecording) return text('No voice recording in this session.')
      return json(session.voiceRecording)
    },

    get_annotations(): ToolResult {
      const session = getSession()
      if (!session?.annotations?.length) return text('No annotations in this session.')
      return json(session.annotations)
    },

    // Screenshot dataUrls are stripped before bridge push to avoid
    // MB-sized WebSocket messages. Works if a future transport preserves them.
    get_screenshot(args: { index: number }): ToolResult {
      const session = getSession()
      if (!session?.screenshots?.[args.index]) return text(`Screenshot ${args.index} not found.`)
      const screenshot = session.screenshots[args.index]
      if (!screenshot.dataUrl) return text('Screenshot image data not available (stripped during bridge push to reduce payload size).')
      const base64 = screenshot.dataUrl.split(',')[1]
      return {
        content: [
          { type: 'image', data: base64, mimeType: 'image/png' },
          { type: 'text', text: JSON.stringify({
            timestampMs: screenshot.timestampMs,
            trigger: screenshot.trigger,
            voiceContext: screenshot.voiceContext,
            descriptionParts: screenshot.descriptionParts,
          }, null, 2) },
        ],
      }
    },
  }
}
