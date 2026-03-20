import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

interface WelcomeScreenProps {
  onFinish: () => void
}

interface HealthStatus {
  checked: boolean
  connected: boolean
  error?: string
}

// Static particle positions — computed once, never during render
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  left: `${(i % 6) * 16.5 + (i % 3) * 2.1}%`,
  top: `${Math.floor(i / 6) * 25 + (i % 4) * 3}%`,
  delay: `${i * 0.15}s`,
}))

export function WelcomeScreen({ onFinish }: WelcomeScreenProps) {
  const [done, setDone] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({ checked: false, connected: false })
  const [showCard, setShowCard] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [lowPowerMode, setLowPowerMode] = useState(false)
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const healthCheckedRef = useRef(false)

  useEffect(() => {
    const cardTimer = setTimeout(() => setShowCard(true), 80)
    return () => clearTimeout(cardTimer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const applyFlags = () => {
      const anyNav = navigator as Navigator & {
        deviceMemory?: number
        connection?: { saveData?: boolean; effectiveType?: string }
      }
      const saveData = Boolean(anyNav.connection?.saveData)
      const weakCpu = (navigator.hardwareConcurrency || 8) <= 4
      const lowMem = (anyNav.deviceMemory || 8) <= 4
      const slowNetwork = (anyNav.connection?.effectiveType || '').includes('2g')
      setReducedMotion(mq.matches)
      setLowPowerMode(saveData || weakCpu || lowMem || slowNetwork)
      setIsMobile(window.innerWidth < 640)
      setHasSeenWelcome(window.sessionStorage.getItem('telemetryx.welcomeSeen') === '1')
    }
    applyFlags()
    const onResize = () => setIsMobile(window.innerWidth < 640)
    mq.addEventListener('change', applyFlags)
    window.addEventListener('resize', onResize)
    return () => {
      mq.removeEventListener('change', applyFlags)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  useEffect(() => {
    if (healthCheckedRef.current) return
    healthCheckedRef.current = true

    const checkHealth = async () => {
      try {
        await api.getHealth()
        setHealthStatus({ checked: true, connected: true })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection failed'
        setHealthStatus({ checked: true, connected: false, error: message })
      }
    }

    checkHealth()
  }, [])

  useEffect(() => {
    if (!healthStatus.checked) return
    
    const proceed = () => {
      setDone(true)
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('telemetryx.welcomeSeen', '1')
      }
      setTimeout(onFinish, 400)
    }

    const firstLoadDelay = healthStatus.connected ? 1350 : 2200
    const repeatLoadDelay = healthStatus.connected ? 520 : 780
    const lowPowerDelay = healthStatus.connected ? 700 : 1000
    const targetDelay = reducedMotion
      ? 420
      : hasSeenWelcome
        ? repeatLoadDelay
        : lowPowerMode
          ? lowPowerDelay
          : firstLoadDelay
    timerRef.current = setTimeout(proceed, targetDelay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [healthStatus, onFinish, hasSeenWelcome, lowPowerMode, reducedMotion])

  const visibleParticles = reducedMotion || lowPowerMode ? 8 : isMobile ? 14 : 24

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        opacity: done ? 0 : 1,
        transition: 'opacity 400ms ease-out',
        background: 'radial-gradient(ellipse at center, #0f0f14 0%, #050507 100%)',
        pointerEvents: done ? 'none' : 'auto',
      }}
    >
      {/* Animated grid background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(225,6,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(225,6,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'gridPulse 4s ease-in-out infinite',
        }}
      />

      {/* CSS-only particle dots — no JS per-frame */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {PARTICLES.slice(0, visibleParticles).map((p, i) => (
          <div
            key={i}
            className="welcome-particle absolute h-[3px] w-[3px] rounded-full"
            style={{ 
              left: p.left, 
              top: p.top, 
              animationDelay: p.delay,
              background: 'radial-gradient(circle, rgba(225,6,0,0.9) 0%, rgba(180,6,0,0.4) 50%, transparent 100%)',
              boxShadow: '0 0 8px rgba(225,6,0,0.7), 0 0 16px rgba(225,6,0,0.3)',
              opacity: 0.5,
              animationDuration: lowPowerMode ? '5.2s' : '3.8s'
            }}
          />
        ))}
      </div>

      {/* Main card */}
      <div
        className={`welcome-card relative z-10 w-full rounded-2xl text-center transition-all duration-700 ${isMobile ? 'max-w-[92vw] p-6' : 'max-w-sm p-10'} ${showCard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        style={{
          background: 'linear-gradient(180deg, rgba(18,18,22,0.98) 0%, rgba(8,8,10,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 30px 100px rgba(0,0,0,0.7), 0 0 60px rgba(225,6,0,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Logo with glow effect */}
        <div className="welcome-logo mx-auto mb-6 flex h-22 w-22 items-center justify-center rounded-2xl transition-all duration-500"
          style={{ 
            background: 'linear-gradient(135deg, rgba(225,6,0,0.25) 0%, rgba(180,6,0,0.08) 100%)', 
            border: '1px solid rgba(225,6,0,0.5)',
            boxShadow: '0 0 40px rgba(225,6,0,0.4), 0 0 80px rgba(225,6,0,0.15), inset 0 0 30px rgba(225,6,0,0.15)',
            animation: 'pulse-glow 3s ease-in-out infinite',
          }}>
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none" aria-hidden className="transition-transform duration-500 hover:scale-110" style={{ filter: 'drop-shadow(0 0 8px rgba(225,6,0,0.5))' }}>
            <path d="M4 24L10 8L16 20L22 12L28 24" stroke="#e10600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="8" r="2.5" fill="#e10600" opacity="0.9" />
            <circle cx="16" cy="20" r="2.5" fill="#e10600" opacity="0.7" />
            <circle cx="22" cy="12" r="2.5" fill="#e10600" opacity="0.9" />
          </svg>
        </div>

        <h1
          className="welcome-title mb-3 text-4xl font-bold tracking-wide"
          style={{
            fontFamily: "'Orbitron', 'Inter', sans-serif",
            background: 'linear-gradient(135deg, #ffffff 0%, #e10600 60%, #ff6b35 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 30px rgba(225,6,0,0.4))',
          }}
        >
          TELEMETRYX
        </h1>
        <p className={`font-medium tracking-[0.23em] uppercase text-[#6a7585] ${isMobile ? 'mb-6 text-[11px]' : 'mb-8 text-sm'}`}>
          Race Intelligence Platform
        </p>

        {/* Health status indicator - Enhanced */}
        {healthStatus.checked && (
          <div 
            className="mb-6 flex items-center justify-center gap-3 rounded-xl px-5 py-3.5 text-sm font-medium transition-all duration-500"
            style={{ 
              background: healthStatus.connected 
                ? 'linear-gradient(135deg, rgba(21,128,61,0.15) 0%, rgba(21,128,61,0.05) 100%)' 
                : 'linear-gradient(135deg, rgba(153,27,27,0.15) 0%, rgba(153,27,27,0.05) 100%)',
              border: `1px solid ${healthStatus.connected ? 'rgba(21,128,61,0.4)' : 'rgba(153,27,27,0.4)'}`,
              boxShadow: healthStatus.connected 
                ? '0 0 30px rgba(21,128,61,0.2), inset 0 0 25px rgba(21,128,61,0.05)' 
                : '0 0 30px rgba(153,27,27,0.2), inset 0 0 25px rgba(153,27,27,0.05)',
            }}
          >
            <div 
              className={`h-3 w-3 rounded-full ${healthStatus.connected ? 'status-pulse-connected' : 'status-pulse-disconnected'}`}
              style={{ 
                background: healthStatus.connected ? '#22c55e' : '#ef4444',
                boxShadow: healthStatus.connected 
                  ? '0 0 10px #22c55e, 0 0 20px rgba(34,197,94,0.6)' 
                  : '0 0 10px #ef4444, 0 0 20px rgba(239,68,68,0.6)'
              }}
            />
            <div className="flex flex-col items-start gap-0.5">
              <span style={{ color: healthStatus.connected ? '#4ade80' : '#f87171' }} className="font-semibold">
                {healthStatus.connected ? 'Backend Connected' : 'Offline Mode'}
              </span>
              {!healthStatus.connected && healthStatus.error && (
                <span style={{ color: '#9ca3af' }} className="text-xs font-normal">
                  {healthStatus.error}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Progress indicator with glow effect */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">
            <span style={{ color: '#4b5563' }}>Initializing</span>
            <span style={{ color: '#e10600' }} className={`font-semibold ${healthStatus.checked ? 'animate-pulse' : ''}`}>
              {healthStatus.checked ? (healthStatus.connected ? 'Ready' : 'Retry') : 'Loading...'}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full progress-glow"
              style={{
                background: healthStatus.checked && !healthStatus.connected 
                  ? 'linear-gradient(90deg,#991b1b,#dc2626,#991b1b)' 
                  : 'linear-gradient(90deg,#7a0300,#e10600,#ff6b35)',
                animation: 'welcomeProgress 2s ease-in-out forwards',
                width: '0%',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
