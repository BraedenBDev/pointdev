#!/usr/bin/env node
import { BridgeServer } from './server.js'
import { buildMcpToolHandlers } from './mcp.js'

const PORT = parseInt(process.env.POINTDEV_PORT || '3456', 10)

async function main() {
  const server = new BridgeServer(PORT)
  await server.start()

  const handlers = buildMcpToolHandlers(() => server.currentSession)

  // MCP stdio server will be wired here in future
  // For now, expose handlers for testing
  console.log('[PointDev Bridge] Ready. Waiting for session data from extension...')
  console.log('[PointDev Bridge] MCP tools: get_session, get_voice_transcript, get_annotations, get_screenshot')

  process.on('SIGINT', async () => {
    await server.stop()
    process.exit(0)
  })
}

main().catch(console.error)
