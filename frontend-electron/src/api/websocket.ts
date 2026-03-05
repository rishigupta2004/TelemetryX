import { getApiRoot } from './client'
import { slugifyRace } from './sessions'

export type TelemetryWsHandler = (data: unknown) => void

function toWsUrl(httpUrl: string): string {
  if (httpUrl.startsWith('https://')) return `wss://${httpUrl.slice(8)}`
  if (httpUrl.startsWith('http://')) return `ws://${httpUrl.slice(7)}`
  return httpUrl
}

export function connectTelemetryWebSocket(params: {
  year?: number | null
  race?: string | null
  session?: string | null
  onMessage: TelemetryWsHandler
  onOpen?: () => void
  onClose?: (event: CloseEvent) => void
  onError?: (event: Event) => void
}): WebSocket {
  const root = getApiRoot()
  const wsBase = toWsUrl(root)
  const url = `${wsBase}/api/v1/ws/telemetry`
  const ws = new WebSocket(url)
  ws.onopen = () => params.onOpen?.()
  ws.onclose = (event) => params.onClose?.(event)
  ws.onerror = (event) => params.onError?.(event)
  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data as string)
      params.onMessage(payload)
    } catch {
      params.onMessage(event.data)
    }
  }
  return ws
}
