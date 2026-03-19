import { describe, expect, it, vi } from 'vitest'

const { getApiRootMock, getAuthTokenMock } = vi.hoisted(() => ({
  getApiRootMock: vi.fn(() => 'http://localhost:9000'),
  getAuthTokenMock: vi.fn(() => 'token_123'),
}))

vi.mock('../../api/client', () => ({
  getApiRoot: getApiRootMock,
}))

vi.mock('../../lib/authToken', () => ({
  getAuthToken: getAuthTokenMock,
}))

class FakeWebSocket {
  static lastUrl: string | null = null
  onopen: (() => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(url: string) {
    FakeWebSocket.lastUrl = url
  }
}

;(globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket as unknown as typeof WebSocket

import { connectTelemetryWebSocket } from '../../api/websocket'

describe('connectTelemetryWebSocket', () => {
  it('includes token and session scope in websocket URL', () => {
    connectTelemetryWebSocket({
      year: 2025,
      race: 'Bahrain Grand Prix',
      session: 'R',
      onMessage: () => {},
    })

    expect(FakeWebSocket.lastUrl).toBe(
      'ws://localhost:9000/api/v1/ws/telemetry?token=token_123&year=2025&race=Bahrain+Grand+Prix&session=R'
    )
  })
})
