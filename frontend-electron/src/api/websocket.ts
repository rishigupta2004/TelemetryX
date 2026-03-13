import { getApiRoot } from './client'
import { getAuthToken } from '../lib/authToken'

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
  const token = getAuthToken()
  const query = new URLSearchParams()
  if (token) query.set('token', token)
  if (params.year != null) query.set('year', String(params.year))
  if (params.race) query.set('race', params.race)
  if (params.session) query.set('session', params.session)
  const suffix = query.size ? `?${query.toString()}` : ''
  const url = `${wsBase}/api/v1/ws/telemetry${suffix}`
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
