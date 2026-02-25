import { useEffect, useRef, useState } from 'react'

interface WelcomeScreenProps {
  onFinish: () => void
}

const PHASES = ['Initializing core', 'Connecting telemetry', 'Loading assets', 'Ready'] as const

export function WelcomeScreen({ onFinish }: WelcomeScreenProps) {
  const [fadeOut, setFadeOut] = useState(false)
  const [phase, setPhase] = useState(0)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(performance.now())

  const TOTAL_DURATION = 2200
  const FADE_DURATION = 400

  useEffect(() => {
    const start = startRef.current
    const tick = (now: number) => {
      const elapsed = now - start
      const pct = Math.min(elapsed / TOTAL_DURATION, 1)
      setProgress(pct)
      setPhase(Math.min(Math.floor(pct * PHASES.length), PHASES.length - 1))

      if (pct >= 1) {
        setFadeOut(true)
        setTimeout(() => onFinish(), FADE_DURATION)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [onFinish])

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity`}
      style={{
        opacity: fadeOut ? 0 : 1,
        transitionDuration: `${FADE_DURATION}ms`,
        background:
          'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(225,6,0,0.08), transparent 60%), radial-gradient(ellipse 60% 50% at 20% 80%, rgba(141,152,166,0.06), transparent 50%), linear-gradient(160deg,#0a0a0a 0%,#0e0e0e 45%,#0a0a0a 100%)'
      }}
    >
      {/* Particle Grid Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 40 }, (_, i) => (
          <div
            key={i}
            className="welcome-particle"
            style={{
              left: `${(i % 8) * 12.5 + Math.random() * 6}%`,
              top: `${Math.floor(i / 8) * 20 + Math.random() * 10}%`,
              animationDelay: `${i * 0.12}s`,
              animationDuration: `${2.5 + Math.random() * 1.5}s`
            }}
          />
        ))}
      </div>

      {/* Horizontal scan line */}
      <div
        className="pointer-events-none absolute left-0 h-px w-full"
        style={{
          top: `${progress * 100}%`,
          background: 'linear-gradient(90deg, transparent, rgba(225,6,0,0.3), transparent)',
          boxShadow: '0 0 20px rgba(225,6,0,0.15)',
          transition: 'top 0.3s ease-out'
        }}
      />

      {/* Main Card */}
      <div
        className="welcome-card relative z-10 w-full max-w-xl rounded-2xl p-10"
        style={{
          background: 'linear-gradient(180deg, rgba(20,20,22,0.95), rgba(10,10,10,0.95))',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(225,6,0,0.04)'
        }}
      >
        {/* Logo area */}
        <div className="mb-8 text-center">
          <div className="welcome-logo mb-3 inline-block">
            <div
              className="inline-flex h-16 w-16 items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(225,6,0,0.15), rgba(225,6,0,0.05))',
                border: '1px solid rgba(225,6,0,0.2)',
                boxShadow: '0 0 30px rgba(225,6,0,0.1)'
              }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M4 24L10 8L16 20L22 12L28 24" stroke="#e10600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="8" r="2" fill="#e10600" opacity="0.8" />
                <circle cx="16" cy="20" r="2" fill="#e10600" opacity="0.6" />
                <circle cx="22" cy="12" r="2" fill="#e10600" opacity="0.8" />
              </svg>
            </div>
          </div>
          <h1
            className="welcome-title text-3xl font-bold tracking-[-0.02em]"
            style={{ fontFamily: "'Orbitron', 'Inter', sans-serif", color: '#e6ecf3' }}
          >
            TelemetryX
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#6f7a88' }}>
            Race Intelligence Platform
          </p>
        </div>

        {/* Progress Section */}
        <div className="space-y-3">
          {/* Phase label */}
          <div className="flex items-center justify-between text-xs">
            <span className="welcome-phase font-mono uppercase tracking-[0.2em]" style={{ color: '#a5b0be' }}>
              {PHASES[phase]}
            </span>
            <span className="font-mono tabular-nums" style={{ color: '#6f7a88' }}>
              {Math.round(progress * 100)}%
            </span>
          </div>

          {/* Progress bar */}
          <div
            className="h-1 w-full overflow-hidden rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-200 ease-out"
              style={{
                width: `${progress * 100}%`,
                background: 'linear-gradient(90deg, #e10600, #ff3b3b)',
                boxShadow: '0 0 12px rgba(225,6,0,0.4)'
              }}
            />
          </div>

          {/* Sub-phases */}
          <div className="flex justify-between pt-1">
            {PHASES.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <div
                  className="h-1.5 w-1.5 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: i <= phase ? '#e10600' : 'rgba(255,255,255,0.08)',
                    boxShadow: i <= phase ? '0 0 6px rgba(225,6,0,0.4)' : 'none'
                  }}
                />
                <span
                  className="text-[10px] transition-colors duration-300"
                  style={{ color: i <= phase ? '#a5b0be' : '#3a3a3a' }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
