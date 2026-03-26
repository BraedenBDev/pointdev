import { WebSocketServer, WebSocket } from 'ws'
import type { AddressInfo } from 'net'

export class BridgeServer {
  private wss: WebSocketServer | null = null
  private _currentSession: any = null
  private _port: number

  constructor(port = 3456) {
    this._port = port
  }

  get port(): number {
    if (this.wss) {
      return (this.wss.address() as AddressInfo).port
    }
    return this._port
  }

  get currentSession(): any {
    return this._currentSession
  }

  pushSession(session: any): void {
    this._currentSession = session
    // Broadcast to connected clients
    if (this.wss) {
      const msg = JSON.stringify({ type: 'session_updated', session })
      for (const client of this.wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg)
        }
      }
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      let started = false
      this.wss = new WebSocketServer({ port: this._port }, () => {
        started = true
        console.log(`[PointDev Bridge] WebSocket server listening on port ${this.port}`)
        resolve()
      })

      this.wss.on('error', (err) => {
        if (!started) {
          reject(err)
        } else {
          console.error('[PointDev Bridge] WebSocket server error:', err)
        }
      })

      this.wss.on('connection', (ws) => {
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString())
            if (msg.type === 'push_session' && msg.session?.id) {
              this.pushSession(msg.session)
            }
          } catch {
            // Ignore malformed messages
          }
        })
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      const server = this.wss
      this.wss = null
      if (server) {
        server.close(() => resolve())
      } else {
        resolve()
      }
    })
  }
}
