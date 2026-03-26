import { describe, it, expect } from 'vitest'
import { buildMcpToolHandlers } from '../../bridge/src/mcp'

describe('MCP tool handlers', () => {
  it('get_session returns null when no session exists', () => {
    const handlers = buildMcpToolHandlers(() => null)
    const result = handlers.get_session()
    expect(result).toEqual({ content: [{ type: 'text', text: 'No active capture session.' }] })
  })

  it('get_session returns session JSON when session exists', () => {
    const session = { id: 'test', url: 'https://example.com', title: 'Test' }
    const handlers = buildMcpToolHandlers(() => session)
    const result = handlers.get_session()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.url).toBe('https://example.com')
  })

  it('get_voice_transcript returns segments', () => {
    const session = {
      voiceRecording: {
        transcript: 'hello world',
        segments: [{ text: 'hello', startMs: 0, endMs: 1000 }],
      },
    }
    const handlers = buildMcpToolHandlers(() => session)
    const result = handlers.get_voice_transcript()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.segments).toHaveLength(1)
  })

  it('get_annotations returns annotation list', () => {
    const session = {
      annotations: [{ type: 'circle', nearestElement: '.btn', timestampMs: 5000 }],
    }
    const handlers = buildMcpToolHandlers(() => session)
    const result = handlers.get_annotations()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveLength(1)
  })

  it('get_screenshot returns image when dataUrl is present', () => {
    const session = {
      screenshots: [{
        dataUrl: 'data:image/png;base64,AQIDBA==',
        timestampMs: 3000,
        trigger: 'voice',
        voiceContext: 'test',
        descriptionParts: ['Voice narration active'],
      }],
    }
    const handlers = buildMcpToolHandlers(() => session)
    const result = handlers.get_screenshot({ index: 0 })
    expect(result.content[0]).toEqual({ type: 'image', data: 'AQIDBA==', mimeType: 'image/png' })
    const meta = JSON.parse(result.content[1].text)
    expect(meta.trigger).toBe('voice')
  })

  it('get_screenshot returns unavailable message when dataUrl is stripped', () => {
    const session = {
      screenshots: [{ timestampMs: 3000, descriptionParts: ['Auto-captured'] }],
    }
    const handlers = buildMcpToolHandlers(() => session)
    const result = handlers.get_screenshot({ index: 0 })
    expect(result.content[0].text).toContain('not available')
  })

  it('get_screenshot returns not found for invalid index', () => {
    const handlers = buildMcpToolHandlers(() => ({ screenshots: [] }))
    const result = handlers.get_screenshot({ index: 5 })
    expect(result.content[0].text).toContain('not found')
  })
})
