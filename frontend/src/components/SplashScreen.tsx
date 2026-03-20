import React, { useEffect, useState } from 'react'

interface SplashScreenProps {
  onComplete: () => void
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [status, setStatus] = useState<'loading' | 'connected' | 'offline'>('loading')
  
  useEffect(() => {
    const minDisplay = new Promise<void>(r => setTimeout(r, 800))
    
    const healthCheck = fetch('http://127.0.0.1:9000/health')
      .then(r => {
        if (!r.ok) throw new Error('Health check failed')
        return r.json()
      })
      .then(() => 'connected' as const)
      .catch(() => 'offline' as const)
    
    Promise.all([minDisplay, healthCheck])
      .then(([, healthStatus]) => {
        setStatus(healthStatus)
        setTimeout(onComplete, 600)
      })
  }, [onComplete])
  
  const getStatusText = () => {
    switch (status) {
      case 'loading': return 'CORE INITIALIZING...'
      case 'connected': return 'UPLINK SECURED'
      case 'offline': return 'OFFLINE FALLBACK'
    }
  }
  
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-bg-void font-ui">
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
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
      
      {/* Glow effect */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(225,6,0,0.1) 0%, transparent 60%)',
          filter: 'blur(40px)'
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <h1 className="text-5xl font-black italic tracking-tighter font-display text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-fg-muted drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
          TELEMETRY<span className="text-red-core drop-shadow-[0_0_24px_rgba(225,6,0,0.6)]">X</span>
        </h1>
        
        {/* Status */}
        <div className="mt-8 flex items-center justify-center gap-3 bg-bg-surface/30 px-4 py-2 border border-border-soft/50 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
          <div 
            className={`w-2 h-2 rounded-sm ${
              status === 'loading' ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]' : 
              status === 'connected' ? 'bg-green-pb animate-pulse shadow-[0_0_8px_#00E5FF]' : 
              'bg-red-core shadow-[0_0_8px_#e10600]'
            }`}
          />
          <span className="text-[10px] font-bold tracking-widest text-fg-muted uppercase font-mono mt-0.5">
            {getStatusText()}
          </span>
        </div>
      </div>
      
      {/* CSS animations moved to external stylesheet for better performance */}
      <div className="sr-only" aria-hidden="true">
        Splash screen animations loaded
      </div>
    </div>
  )
}
