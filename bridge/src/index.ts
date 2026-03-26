#!/usr/bin/env node
import { BridgeServer } from './server.js'
import { buildMcpToolHandlers } from './mcp.js'

const PORT = parseInt(process.env.POINTDEV_PORT || '3456', 10)

async function main(): Promise<void> {
  const server = new BridgeServer(PORT)
  await server.start()

  // MCP stdio server will wire these handlers in a future release
  const _handlers = buildMcpToolHandlers(() => server.currentSession)

  console.log('[PointDev Bridge] Ready. Waiting for session data from extension...')

  process.on('SIGINT', async () => {
    await server.stop()
    process.exit(0)
  })
}

main().catch(console.error)
