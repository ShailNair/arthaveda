'use client'
import { WSMessage } from './types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws'

type Handler = (msg: WSMessage) => void

class WSClient {
  private ws: WebSocket | null = null
  private handlers: Set<Handler> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null

  connect() {
    if (typeof window === 'undefined') return
    if (this.ws?.readyState === WebSocket.OPEN) return

    try {
      this.ws = new WebSocket(WS_URL)

      this.ws.onopen = () => {
        console.log('[WS] Connected')
        this.pingTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send('ping')
          }
        }, 25000)
      }

      this.ws.onmessage = (evt) => {
        try {
          const msg: WSMessage = JSON.parse(evt.data)
          this.handlers.forEach(h => h(msg))
        } catch { }
      }

      this.ws.onclose = () => {
        console.log('[WS] Disconnected — reconnecting in 5s')
        if (this.pingTimer) clearInterval(this.pingTimer)
        this.reconnectTimer = setTimeout(() => this.connect(), 5000)
      }

      this.ws.onerror = () => {
        this.ws?.close()
      }
    } catch (e) {
      console.log('[WS] Connection failed, will retry')
      this.reconnectTimer = setTimeout(() => this.connect(), 5000)
    }
  }

  subscribe(handler: Handler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.pingTimer) clearInterval(this.pingTimer)
    this.ws?.close()
  }
}

export const wsClient = new WSClient()
