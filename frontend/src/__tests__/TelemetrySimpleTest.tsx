import { useEffect, useState } from 'react'

interface TelemetryData {
  timestamp?: number
  speed?: number
  throttle?: number
  brake?: number
  gear?: number
  drs?: number
  [key: string]: unknown
}

interface TelemetryResponse {
  data?: TelemetryData[]
  timestamps?: number[]
  drivers?: string[]
}

const YEAR = 2025
const RACE = 'Japanese Grand Prix'
const SESSION = 'R'
const T0 = 3366
const T1 = 3468

export default function TelemetrySimpleTest() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [data, setData] = useState<TelemetryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTelemetry() {
      setStatus('loading')
      setError(null)

      try {
        const baseUrl = 'http://127.0.0.1:9000/api/v1'
        const url = `${baseUrl}/sessions/${YEAR}/${encodeURIComponent(RACE)}/${SESSION}/telemetry?t0=${T0}&t1=${T1}`

        console.log('[TelemetrySimpleTest] Fetching:', url)

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const result = await response.json()
        console.log('[TelemetrySimpleTest] Raw response:', result)
        setData(result)
        setStatus('success')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[TelemetrySimpleTest] Error:', message)
        setError(message)
        setStatus('error')
      }
    }

    fetchTelemetry()
  }, [])

  const statusColor = {
    idle: '#888',
    loading: '#f59e0b',
    success: '#22c55e',
    error: '#ef4444'
  }[status]

  // Response is object with driver codes as keys, e.g. { VER: [...], NOR: [...] }
  const responseObj = data as Record<string, unknown[]>
  const firstDriverKey = responseObj ? Object.keys(responseObj)[0] : null
  const telData = firstDriverKey ? (responseObj[firstDriverKey] as TelemetryData[] || []) : []

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'monospace',
      background: '#1a1a2e',
      color: '#eee',
      minHeight: '100vh'
    }}>
      <h2 style={{ marginBottom: '16px' }}>Telemetry Simple Test</h2>

      <div style={{
        padding: '12px',
        background: '#16213e',
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <strong>Request:</strong> GET /sessions/{YEAR}/{encodeURIComponent(RACE)}/{SESSION}/telemetry?t0={T0}&t1={T1}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px',
        background: '#16213e',
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: statusColor
        }} />
        <span>Status: <strong>{status.toUpperCase()}</strong></span>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          background: '#7f1d1d',
          borderRadius: '8px',
          marginBottom: '16px',
          color: '#fecaca'
        }}>
          Error: {error}
        </div>
      )}

      {status === 'success' && (
        <>
          <div style={{
            padding: '12px',
            background: '#16213e',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <strong>Driver:</strong> {firstDriverKey || 'N/A'} | <strong>Data Points:</strong> {telData.length}
          </div>

          {telData.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '8px' }}>Speed Chart</h3>
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                height: '100px',
                gap: '1px',
                background: '#16213e',
                padding: '8px',
                borderRadius: '8px'
              }}>
                {telData.slice(0, 100).map((point, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      background: '#3b82f6',
                      height: `${Math.min(100, ((point.speed || 0) / 350) * 100)}%`,
                      minHeight: '2px'
                    }}
                    title={`Speed: ${point.speed}`}
                  />
                ))}
              </div>
            </div>
          )}

          <div style={{
            maxHeight: '300px',
            overflow: 'auto',
            background: '#16213e',
            borderRadius: '8px',
            padding: '8px'
          }}>
            <h3 style={{ marginBottom: '8px' }}>Raw Data (first 20 rows)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  <th style={{ padding: '4px', textAlign: 'left' }}>idx</th>
                  <th style={{ padding: '4px', textAlign: 'left' }}>timestamp</th>
                  <th style={{ padding: '4px', textAlign: 'left' }}>speed</th>
                  <th style={{ padding: '4px', textAlign: 'left' }}>throttle</th>
                  <th style={{ padding: '4px', textAlign: 'left' }}>brake</th>
                  <th style={{ padding: '4px', textAlign: 'left' }}>gear</th>
                </tr>
              </thead>
              <tbody>
                {telData.slice(0, 20).map((point, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ padding: '4px' }}>{i}</td>
                    <td style={{ padding: '4px' }}>{point.timestamp}</td>
                    <td style={{ padding: '4px' }}>{point.speed}</td>
                    <td style={{ padding: '4px' }}>{point.throttle}</td>
                    <td style={{ padding: '4px' }}>{point.brake}</td>
                    <td style={{ padding: '4px' }}>{point.gear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}