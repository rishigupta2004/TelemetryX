import { useEffect, useRef, useState } from 'react'

interface WelcomeScreenProps {
  onFinish: () => void
}

// Static particle positions — computed once, never during render
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  left: `${(i % 6) * 16.5 + (i % 3) * 2.1}%`,
  top: `${Math.floor(i / 6) * 25 + (i % 4) * 3}%`,
  delay: `${i * 0.15}s`,
}))

export function WelcomeScreen({ onFinish }: WelcomeScreenProps) {
  const [done, setDone] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Show for 2 seconds total, then fade out (300ms), then call onFinish
    timerRef.current = setTimeout(() => {
      setDone(true)
      setTimeout(onFinish, 300)
    }, 2000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onFinish])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        opacity: done ? 0 : 1,
        transition: 'opacity 300ms ease-out',
        background: 'linear-gradient(160deg,#0a0a0a 0%,#0e0e0e 100%)',
        pointerEvents: done ? 'none' : 'auto',
      }}
    >
      {/* CSS-only particle dots — no JS per-frame */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="welcome-particle absolute h-[2px] w-[2px] rounded-full"
            style={{ left: p.left, top: p.top, animationDelay: p.delay }}
          />
        ))}
      </div>

      {/* Main card */}
      <div
        className="welcome-card relative z-10 w-full max-w-sm rounded-2xl p-10 text-center"
        style={{
          background: 'rgba(14,14,14,0.96)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div className="welcome-logo mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl"
          style={{ background: 'rgba(225,6,0,0.1)', border: '1px solid rgba(225,6,0,0.2)' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
            <path d="M4 24L10 8L16 20L22 12L28 24" stroke="#e10600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="8" r="2" fill="#e10600" opacity="0.8" />
            <circle cx="16" cy="20" r="2" fill="#e10600" opacity="0.6" />
            <circle cx="22" cy="12" r="2" fill="#e10600" opacity="0.8" />
          </svg>
        </div>

        <h1
          className="welcome-title mb-1 text-2xl font-bold tracking-tight text-white"
          style={{ fontFamily: "'Orbitron', 'Inter', sans-serif" }}
        >
          TelemetryX
        </h1>
        <p className="mb-6 text-xs text-[#6f7a88]">Race Intelligence Platform</p>

        {/* Simple progress bar — CSS animation only */}
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg,#e10600,#ff3b3b)',
              animation: 'welcomeProgress 2s linear forwards',
              width: '0%',
            }}
          />
        </div>
      </div>
    </div>
  )
}
