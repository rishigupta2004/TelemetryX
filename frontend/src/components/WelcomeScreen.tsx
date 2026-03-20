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

    const firstLoadDelay = healthStatus.connected ? 1500 : 2200
    const repeatLoadDelay = healthStatus.connected ? 600 : 780
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
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-bg-void"
      style={{
        opacity: done ? 0 : 1,
        transition: 'opacity 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: done ? 'none' : 'auto',
      }}
    >
      {/* Cinematic HUD Backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(15,15,20,1)_0%,rgba(3,4,6,1)_100%)] z-0" />
      
      {/* Vignettting & Scanlines */}
      <div className="absolute inset-0 z-[1] opacity-40 pointer-events-none" style={{ background: 'radial-gradient(circle, transparent 20%, #000 120%)' }} />
      <div className="absolute inset-0 z-[2] opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPg==')] animate-pulse" />

      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 z-[1] opacity-15 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(225,6,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(225,6,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          backgroundPosition: 'center center',
          animation: 'gridPulse 4s ease-in-out infinite',
        }}
      />

      {/* CSS-only particle dots */}
      <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" aria-hidden>
        {PARTICLES.slice(0, visibleParticles).map((p, i) => (
          <div
            key={i}
            className="absolute h-[2px] w-[2px] rounded-full"
            style={{ 
              left: p.left, 
              top: p.top, 
              animationDelay: p.delay,
              background: 'rgba(225,6,0,0.8)',
              boxShadow: '0 0 12px rgba(225,6,0,0.6)',
              opacity: 0.6,
              animation: `pulse-glow ${lowPowerMode ? '5.2s' : '3.8s'} infinite`
            }}
          />
        ))}
      </div>

      {/* Dynamic AAA Loading Container */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center transition-all duration-1000 ${showCard ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        {/* Holographic Logo Array */}
        <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
          {/* Animated rings */}
          <div className="absolute inset-0 rounded-full border border-red-core/30 animate-[spin_8s_linear_infinite] shadow-[0_0_30px_rgba(225,6,0,0.2)]" />
          <div className="absolute inset-2 rounded-full border border-red-core/20 border-dashed animate-[spin_12s_linear_infinite_reverse]" />
          <div className="absolute inset-0 bg-red-core/10 rounded-full blur-xl animate-pulse" />
          
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none" aria-hidden className="relative z-10 drop-shadow-[0_0_12px_rgba(225,6,0,0.8)]">
            <path d="M4 24L10 8L16 20L22 12L28 24" stroke="#e10600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="8" r="2.5" fill="#e10600" />
            <circle cx="16" cy="20" r="2.5" fill="#e10600" opacity="0.8" />
            <circle cx="22" cy="12" r="2.5" fill="#e10600" />
          </svg>
        </div>

        {/* Cinematic Title */}
        <div className="flex flex-col items-center">
          <h1 className="font-display text-5xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-fg-muted drop-shadow-[0_0_16px_rgba(255,255,255,0.2)]">
            TELEMETRY<span className="text-red-core drop-shadow-[0_0_24px_rgba(225,6,0,0.6)]">X</span>
          </h1>
          <div className="mt-2 flex items-center gap-4">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-red-core/50" />
            <p className="font-heading text-[12px] uppercase tracking-[0.4em] text-red-core drop-shadow-[0_0_8px_rgba(225,6,0,0.4)]">
              INITIALIZATION SEQUENCE
            </p>
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-red-core/50" />
          </div>
        </div>

        {/* Boot Sequence Terminal Output */}
        <div className="mt-16 w-[320px] md:w-[480px]">
          {healthStatus.checked && (
            <div 
              className="mb-4 flex items-center justify-between text-xs font-mono font-bold uppercase tracking-widest transition-all duration-500"
              style={{ color: healthStatus.connected ? '#00FF00' : '#FF2D2D', textShadow: `0 0 10px ${healthStatus.connected ? 'rgba(0,255,0,0.5)' : 'rgba(255,45,45,0.5)'}` }}
            >
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-sm ${healthStatus.connected ? 'bg-[#00FF00] animate-pulse' : 'bg-[#FF2D2D]'}`} style={{ boxShadow: `0 0 8px ${healthStatus.connected ? '#00FF00' : '#FF2D2D'}` }} />
                <span>{healthStatus.connected ? 'SECURE CONNECTION ESTABLISHED' : 'SYSTEM OFFLINE'}</span>
              </div>
              <span className="opacity-70">{healthStatus.connected ? 'OK' : 'ERR'}</span>
            </div>
          )}

          {!healthStatus.checked && (
             <div className="mb-4 flex items-center justify-between text-xs font-mono font-bold uppercase tracking-widest text-[#FFB800] drop-shadow-[0_0_10px_rgba(255,184,0,0.5)]">
               <div className="flex items-center gap-3">
                 <span className="h-2 w-2 rounded-sm bg-[#FFB800] animate-pulse" style={{ boxShadow: '0 0 8px #FFB800' }} />
                 <span>HANDSHAKING CORE SERVICES</span>
               </div>
               <span className="opacity-70 animate-pulse">WAIT</span>
             </div>
          )}

          {/* Aggressive Progress Bar */}
          <div className="relative h-1 w-full overflow-hidden bg-bg-surface border border-border-micro">
            <div
              className="absolute left-0 top-0 h-full bg-red-core shadow-[0_0_12px_rgba(225,6,0,0.8)] transition-all ease-out"
              style={{
                width: healthStatus.checked ? (healthStatus.connected ? '100%' : '15%') : '40%',
                transitionDuration: healthStatus.checked ? '800ms' : '2000ms'
              }}
            />
          </div>
          
          <div className="mt-3 flex justify-between font-mono text-[9px] uppercase tracking-widest text-fg-muted/60">
            <span>SYS.VER 2.4.1</span>
            <span>{hasSeenWelcome ? 'FAST_BOOT_ENGAGED' : 'COLD_START'}</span>
          </div>
        </div>
      </div>
      
      {/* Performance optimization */}
      <div className="sr-only" aria-hidden="true">
        Session picker animations loaded
      </div>
    </div>
  )
}
