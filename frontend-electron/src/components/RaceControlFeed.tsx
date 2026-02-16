import React, { useMemo } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { usePlaybackStore } from '../stores/playbackStore'

function getMessageStyle(msg: any) {
  const flag = (msg.flag || '').toUpperCase()
  const category = (msg.category || '').toLowerCase()

  if (category === 'safetycar') {
    return { 
      bg: 'bg-orange-500/10', 
      border: 'border-l-orange-500',
      badge: msg.message?.includes('VIRTUAL') ? 'VSC' : 'SC',
      badgeColor: 'bg-orange-500/20 text-orange-400',
    }
  }
  if (flag === 'GREEN') return { bg: 'bg-green-500/5', border: 'border-l-green-500' }
  if (flag.includes('YELLOW')) return { bg: 'bg-yellow-500/10', border: 'border-l-yellow-500' }
  if (flag === 'RED') return { 
    bg: 'bg-red-500/10', border: 'border-l-red-500',
    badge: 'RED', badgeColor: 'bg-red-500/20 text-red-400',
  }
  if (flag === 'CHEQUERED') return { 
    bg: 'bg-white/5', border: 'border-l-white',
    badge: '🏁', badgeColor: 'bg-white/10 text-white',
  }
  if (flag === 'BLACK AND WHITE') return { bg: 'bg-yellow-500/5', border: 'border-l-yellow-600' }
  if (category === 'drs') return { 
    bg: 'bg-blue-500/5', border: 'border-l-blue-500',
    badge: 'DRS', badgeColor: 'bg-blue-500/20 text-blue-400',
  }
  return { bg: 'bg-bg-card', border: 'border-l-border' }
}

export function RaceControlFeed() {
  // ALL hooks at the top — no exceptions
  const sessionData = useSessionStore(s => s.sessionData)
  const currentTime = usePlaybackStore(s => s.currentTime)
  const sessionStartTime = usePlaybackStore(s => s.sessionStartTime)

  // Derived values — plain calculation, no hooks
  const sessionTime = sessionStartTime + currentTime

  // Filter messages: only show messages DURING the race
  // (timestamp >= sessionStartTime) and up to current time
  const messages = useMemo(() => {
    const rc = sessionData?.raceControl
    if (!rc || !rc.length) return []
    
    return rc
      .filter((m: any) => 
        m.timestamp >= sessionStartTime &&
        m.timestamp <= sessionTime
      )
      .reverse()
  }, [sessionData?.raceControl, sessionStartTime, sessionTime])

  // Current flag status
  const currentFlag = useMemo(() => {
    const rc = sessionData?.raceControl
    if (!rc || !rc.length) return null
    
    const trackFlags = rc.filter(
      (m: any) => m.category === 'Flag' && 
      m.scope === 'Track' && 
      m.timestamp >= sessionStartTime &&
      m.timestamp <= sessionTime
    )
    return trackFlags.length > 0 
      ? trackFlags[trackFlags.length - 1] 
      : null
  }, [sessionData?.raceControl, sessionStartTime, sessionTime])

  if (messages.length === 0) {
    return (
      <div className="bg-bg-card rounded-md p-3 h-full flex items-center 
                      justify-center text-text-muted text-sm">
        No race control messages
      </div>
    )
  }

  return (
    <div className="bg-bg-card rounded-md flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 
                      border-b border-border flex-shrink-0">
        <span className="text-text-secondary text-xs uppercase tracking-wider">
          Race Control
        </span>
        {currentFlag && (
          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase
            ${currentFlag.flag === 'GREEN' || currentFlag.flag === 'CLEAR'
              ? 'bg-green-500/20 text-green-400'
              : currentFlag.flag === 'CHEQUERED'
              ? 'bg-white/10 text-white'
              : currentFlag.flag?.includes('YELLOW')
              ? 'bg-yellow-500/20 text-yellow-400'
              : currentFlag.flag === 'RED'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-bg-hover text-text-secondary'
            }`}>
            {currentFlag.flag === 'CLEAR' ? 'GREEN' : currentFlag.flag}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.map((msg: any, i: number) => {
          const style = getMessageStyle(msg)
          return (
            <div
              key={`${msg.timestamp}-${i}`}
              className={`${style.bg} border-l-2 ${style.border} 
                         px-3 py-1.5 border-b border-border/50`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-text-muted text-[10px] font-mono">
                  {msg.time}
                </span>
                {msg.lap && (
                  <span className="text-text-muted text-[10px]">
                    L{msg.lap}
                  </span>
                )}
                {style.badge && (
                  <span className={`text-[9px] px-1.5 py-0 rounded font-bold ${style.badgeColor}`}>
                    {style.badge}
                  </span>
                )}
                {msg.racingNumber && (
                  <span className="text-text-muted text-[10px]">
                    #{msg.racingNumber}
                  </span>
                )}
              </div>
              <div className="text-text-primary text-xs leading-tight">
                {msg.message}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
