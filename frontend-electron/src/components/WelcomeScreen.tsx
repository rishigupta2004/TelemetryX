import { useEffect, useState } from 'react'

interface WelcomeScreenProps {
  onFinish: () => void
}

export function WelcomeScreen({ onFinish }: WelcomeScreenProps) {
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const intro = window.setTimeout(() => setFadeOut(true), 1350)
    const done = window.setTimeout(() => onFinish(), 1850)
    return () => {
      window.clearTimeout(intro)
      window.clearTimeout(done)
    }
  }, [onFinish])

  return (
    <div
      className={`flex h-screen w-screen items-center justify-center p-10 transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background:
          'radial-gradient(circle at 15% 15%, rgba(71,166,255,0.24), transparent 36%), radial-gradient(circle at 80% 85%, rgba(242,63,86,0.2), transparent 40%), linear-gradient(145deg,#060c19,#0a1631 45%,#070d1d)'
      }}
    >
      <div className="glass-panel-strong w-full max-w-5xl rounded-[30px] p-12">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-[#9fb8e8]">Desktop Race Intelligence</p>
            <h1 className="mt-4 font-['Plus_Jakarta_Sans','Avenir_Next',sans-serif] text-7xl font-semibold leading-[0.98] tracking-[-0.03em] text-white">
              TelemetryX
            </h1>
            <p className="mt-6 max-w-3xl text-lg text-[#d4e4ff]">
              Strategy, telemetry, race control, and live timing unified into a premium command center.
            </p>
          </div>
          <div className="mt-1 rounded-full border border-[#7fb6ff55] bg-[#102447bb] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#a6ccff]">
            Initializing
          </div>
        </div>

        <div className="mt-10 h-1.5 w-full overflow-hidden rounded-full bg-[#1f3e6b]">
          <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#47a6ff] via-[#f4f8ff] to-[#f23f56]" />
        </div>
      </div>
    </div>
  )
}
