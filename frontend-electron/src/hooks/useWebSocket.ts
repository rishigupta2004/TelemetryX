import { useEffect, useRef, useState } from 'react'
import { connectTelemetryWebSocket } from '../api/websocket'

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export function useWebSocket(params: {
  year: number | null
  race: string | null
  session: string | null
  onMessage: (payload: unknown) => void
}) {
  const { year, race, session, onMessage } = params
  const [status, setStatus] = useState<WsStatus>('disconnected')
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!year || !race || !session) return
    setStatus('connecting')

    const ws = connectTelemetryWebSocket({
      year,
      race,
      session,
      onMessage,
      onOpen: () => setStatus('connected'),
      onClose: () => setStatus('disconnected'),
      onError: () => setStatus('error')
    })

    wsRef.current = ws
    return () => {
      ws.close()
      wsRef.current = null
      setStatus('disconnected')
    }
  }, [year, race, session, onMessage])

  return { status, ws: wsRef.current }
}
