type GetSession = () => any | null

interface ToolResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>
}

export function buildMcpToolHandlers(getSession: GetSession) {
  return {
    get_session(): ToolResult {
      const session = getSession()
      if (!session) {
        return { content: [{ type: 'text', text: 'No active capture session.' }] }
      }
      const { screenshots, ...rest } = session
      const withoutDataUrls = {
        ...rest,
        screenshots: (screenshots || []).map((s: any) => {
          const { dataUrl, ...meta } = s
          return meta
        }),
      }
      return { content: [{ type: 'text', text: JSON.stringify(withoutDataUrls, null, 2) }] }
    },

    get_voice_transcript(): ToolResult {
      const session = getSession()
      if (!session?.voiceRecording) {
        return { content: [{ type: 'text', text: 'No voice recording in this session.' }] }
      }
      return { content: [{ type: 'text', text: JSON.stringify(session.voiceRecording, null, 2) }] }
    },

    get_annotations(): ToolResult {
      const session = getSession()
      if (!session?.annotations?.length) {
        return { content: [{ type: 'text', text: 'No annotations in this session.' }] }
      }
      return { content: [{ type: 'text', text: JSON.stringify(session.annotations, null, 2) }] }
    },

    get_screenshot(args: { index: number }): ToolResult {
      const session = getSession()
      if (!session?.screenshots?.[args.index]) {
        return { content: [{ type: 'text', text: `Screenshot ${args.index} not found.` }] }
      }
      const screenshot = session.screenshots[args.index]
      if (!screenshot.dataUrl) {
        return { content: [{ type: 'text', text: 'Screenshot image data not available.' }] }
      }
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
