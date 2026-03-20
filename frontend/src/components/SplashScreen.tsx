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
      case 'loading': return 'Initializing...'
      case 'connected': return 'Connected'
      case 'offline': return 'Offline Mode'
    }
  }
  
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center splash-screen">
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 50px,
            rgba(255,255,255,0.02) 50px,
            rgba(255,255,255,0.02) 51px
          ),
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 50px,
            rgba(255,255,255,0.02) 50px,
            rgba(255,255,255,0.02) 51px
          )`
        }}
      />
      
      {/* Glow effect */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(225,6,0,0.15) 0%, transparent 70%)',
          filter: 'blur(40px)'
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <h1 className="text-6xl font-bold tracking-tight splash-logo">
          TelemetryX
        </h1>
        
        {/* Status */}
        <div className="mt-8 flex items-center gap-3">
          <div 
            className={`w-2 h-2 rounded-full splash-status-dot ${
              status === 'loading' ? 'bg-gray-500' : 
              status === 'connected' ? 'bg-green-500 shadow-green-500/50' : 
              'bg-amber-500 shadow-amber-500/50'
            }`}
          />
          <span className="text-sm text-gray-500 font-mono">
            {getStatusText()}
          </span>
        </div>
      </div>
      
      {/* CSS animations */}
      {/* CSS animations moved to external stylesheet for better performance */}
      <div className="sr-only" aria-hidden="true">
        Splash screen animations loaded
      </div>
    </div>
  )
}
