import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BridgeServer } from '../../bridge/src/server'

describe('BridgeServer', () => {
  let server: BridgeServer

  beforeEach(() => {
    server = new BridgeServer(0) // port 0 = random available port
  })

  afterEach(async () => {
    await server.stop()
  })

  it('starts and stops without error', async () => {
    await server.start()
    expect(server.port).toBeGreaterThan(0)
    // afterEach handles stop — no explicit stop here to avoid double-stop
  })

  it('stores session data received via pushSession', () => {
    const session = { id: 'test', url: 'https://example.com' }
    server.pushSession(session as any)
    expect(server.currentSession).toEqual(session)
  })

  it('returns null when no session is stored', () => {
    expect(server.currentSession).toBeNull()
  })
})
