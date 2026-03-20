import React, { useRef } from 'react'
import type { ReactNode } from 'react'

const compoundConfig = {
    S: { color: '#FF3333', label: 'Soft' },
    M: { color: '#FFDD00', label: 'Medium' },
    H: { color: '#FFFFFF', label: 'Hard' },
    I: { color: '#33FF33', label: 'Inter' },
    W: { color: '#0066FF', label: 'Wet' },
    U: { color: '#666666', label: 'Unknown' },
    '?': { color: '#666666', label: 'Unknown' }
}

export const DataValue = React.memo(function DataValue({
    value,
    unit,
    label,
    size = 'md',
    trend,
    font = 'ui',
    flash = false,
    flashColor = 'var(--purple-best)'
}: {
    value: string | number
    unit?: string
    label?: string
    size?: 'sm' | 'md' | 'lg'
    trend?: 'up' | 'down' | 'neutral'
    font?: 'orbitron' | 'mono' | 'ui'
    flash?: boolean
    flashColor?: string
}) {
    const prevValueRef = useRef(value)
    const [isFlashing, setIsFlashing] = React.useState(false)

    React.useEffect(() => {
        if (value !== prevValueRef.current && flash) {
            setIsFlashing(true)
            const timer = setTimeout(() => setIsFlashing(false), 150)
            prevValueRef.current = value
            return () => clearTimeout(timer)
        }
    }, [value, flash])

    const sizeClasses = {
        sm: { label: 'text-[9px] tracking-widest', value: 'text-sm shadow-sm', unit: 'text-[9px]' },
        md: { label: 'text-[11px] tracking-widest', value: 'text-xl drop-shadow-md', unit: 'text-[11px]' },
        lg: { label: 'text-xs tracking-widest', value: 'text-4xl drop-shadow-lg tracking-tight', unit: 'text-sm' }
    }

    const fontClasses = {
        orbitron: 'font-heading',
        mono: 'font-mono',
        ui: 'font-display'
    }

    const trendColors = {
        up: 'text-green-pb drop-shadow-[0_0_8px_rgba(0,255,0,0.4)]',
        down: 'text-red-core drop-shadow-[0_0_8px_rgba(255,45,45,0.4)]',
        neutral: 'text-fg-secondary text-opacity-60'
    }

    const trendIcons = {
        up: '↗',
        down: '↘',
        neutral: '→'
    }

    return (
        <div className="flex flex-col items-center justify-center gap-1 group">
            {label && (
                <span className={`${sizeClasses[size].label} font-ui text-fg-muted uppercase opacity-75 group-hover:opacity-100 transition-opacity duration-300`}>
                    {label}
                </span>
            )}
            <div className="flex items-baseline gap-1.5 relative">
                {trend && (
                    <span className={`text-xs font-bold leading-none ${trendColors[trend]} transition-colors duration-300`}>
                        {trendIcons[trend]}
                    </span>
                )}
                <span className={`${sizeClasses[size].value} ${fontClasses[font]} font-extrabold text-fg-primary ${isFlashing ? 'animate-pulse text-white drop-shadow-[0_0_12px_var(--flash-color)] scale-105 transition-transform' : 'transition-transform duration-300 ease-out'}`}
                      style={isFlashing ? { '--flash-color': flashColor, textShadow: `0 0 16px ${flashColor}` } as React.CSSProperties : undefined}>
                    {value}
                </span>
                {unit && (
                    <span className={`${sizeClasses[size].unit} font-mono font-medium text-fg-secondary opacity-70`}>
                        {unit}
                    </span>
                )}
            </div>
        </div>
    )
})

export const DriverBadge = React.memo(function DriverBadge({
    abbreviation,
    teamColor,
    position,
    size = 'md'
}: {
    abbreviation: string
    teamColor?: string
    position?: number
    size?: 'sm' | 'md' | 'lg'
}) {
    const sizeClasses = {
        sm: 'text-[10px] px-1.5 py-0.5',
        md: 'text-[13px] px-2.5 py-1',
        lg: 'text-sm px-3.5 py-1.5'
    }

    return (
        <div className="relative inline-flex items-center group cursor-default">
            {teamColor && (
                <div
                    className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-md shadow-[0_0_8px_var(--tw-shadow-color)] transition-all duration-300 group-hover:w-2"
                    style={{ backgroundColor: teamColor, '--tw-shadow-color': teamColor } as React.CSSProperties}
                />
            )}
            <div
                className={`flex items-center justify-center rounded-md font-mono font-bold bg-bg-surface/80 backdrop-blur-sm border border-border-soft shadow-inner ${sizeClasses[size]} transition-all duration-300 group-hover:bg-bg-panel group-hover:border-border-hard`}
                style={{ paddingLeft: teamColor ? '0.6rem' : undefined }}
            >
                {position && (
                    <span className="mr-2 text-fg-muted font-ui font-medium opacity-60">
                        {position}.
                    </span>
                )}
                <span className="text-fg-primary tracking-wide drop-shadow-sm">{abbreviation}</span>
            </div>
        </div>
    )
})

export const TyreIndicator = React.memo(function TyreIndicator({
    compound,
    laps,
    degradationLevel
}: {
    compound: 'S' | 'M' | 'H' | 'I' | 'W' | 'U' | '?'
    laps: number
    degradationLevel?: number
}) {
    const config = compoundConfig[compound] || compoundConfig['?']
    const degradation = degradationLevel ?? 0

    const degradationColor = degradation < 0.3 
        ? 'bg-green-pb' 
        : degradation < 0.7 
            ? 'bg-amber-slow shadow-[0_0_8px_rgba(255,184,0,0.5)]' 
            : 'bg-red-core shadow-[0_0_8px_rgba(255,45,45,0.7)] animate-pulse'

    return (
        <div className="inline-flex items-center gap-3 bg-bg-inset/50 backdrop-blur-md px-2.5 py-1.5 rounded-md border border-border-micro relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer-progress pointer-events-none" />
            <div className="flex items-center gap-2 relative z-10">
                <span
                    className="h-3 w-3 rounded-full ring-2 ring-opacity-20 ring-offset-1 ring-offset-bg-inset shadow-md"
                    style={{ backgroundColor: config.color, '--tw-ring-color': config.color } as React.CSSProperties}
                />
                <span className="font-heading text-xs font-bold uppercase text-fg-secondary tracking-widest drop-shadow-sm">
                    {compound}
                </span>
                <span className="font-mono text-sm font-black text-fg-primary w-5 text-right drop-shadow-md">{laps}</span>
            </div>
            {degradationLevel !== undefined && (
                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-bg-void border border-border-soft relative z-10 shadow-inner">
                    <div
                        className={`h-full ${degradationColor} transition-all duration-500 ease-out`}
                        style={{ width: `${degradation * 100}%` }}
                    />
                </div>
            )}
        </div>
    )
})

export const DeltaBadge = React.memo(function DeltaBadge({
    delta,
    format = 'gap'
}: {
    delta: number
    format?: 'gap' | 'interval' | 'sector'
}) {
    const formatDelta = () => {
        const absDelta = Math.abs(delta)
        const formatted = absDelta.toFixed(3).replace(/^0/, '')
        
        switch (format) {
            case 'gap':
                return delta >= 0 ? `+${formatted}` : `-${formatted}`
            case 'interval':
                return delta >= 0 ? `-${formatted}` : `+${formatted}`
            case 'sector':
                return delta >= 0 ? `-${formatted}` : `+${formatted}`
            default:
                return `${delta >= 0 ? '+' : '-'}${formatted}`
        }
    }

    const getColor = () => {
        if (delta < 0) return 'text-green-pb drop-shadow-[0_0_6px_rgba(0,255,0,0.3)]'
        if (delta > 0) return 'text-red-core drop-shadow-[0_0_6px_rgba(255,45,45,0.3)]'
        return 'text-fg-muted'
    }

    return (
        <span className={`font-mono text-[13px] tracking-tight font-extrabold ${getColor()}`}>
            {formatDelta()}
        </span>
    )
})

export const StatusFlag = React.memo(function StatusFlag({
    status
}: {
    status: 'green' | 'yellow' | 'sc' | 'vsc' | 'red' | 'chequered'
}) {
    const statusConfig = {
        green: {
            label: 'GREEN',
            bgClass: 'bg-green-pb/10',
            textClass: 'text-green-pb drop-shadow-[0_0_8px_rgba(0,255,0,0.6)]',
            borderClass: 'border-green-pb/40',
            pulse: ''
        },
        yellow: {
            label: 'YELLOW',
            bgClass: 'bg-amber-warn/10',
            textClass: 'text-amber-warn drop-shadow-[0_0_8px_rgba(255,184,0,0.6)]',
            borderClass: 'border-amber-warn/40',
            pulse: 'animate-pulse'
        },
        sc: {
            label: 'SC',
            bgClass: 'bg-orange-sc/15',
            textClass: 'text-orange-sc drop-shadow-[0_0_8px_rgba(255,150,0,0.8)]',
            borderClass: 'border-orange-sc/50',
            pulse: 'animate-pulse'
        },
        vsc: {
            label: 'VSC',
            bgClass: 'bg-vsc/15',
            textClass: 'text-vsc drop-shadow-[0_0_8px_rgba(255,184,0,0.8)]',
            borderClass: 'border-vsc/50',
            pulse: 'animate-pulse'
        },
        red: {
            label: 'RED FLAG',
            bgClass: 'bg-red-core/15',
            textClass: 'text-red-core drop-shadow-[0_0_12px_rgba(255,45,45,0.9)]',
            borderClass: 'border-red-core/50',
            pulse: 'animate-pulse'
        },
        chequered: {
            label: 'FIN',
            bgClass: 'bg-fg-primary/10',
            textClass: 'text-fg-primary',
            borderClass: 'border-fg-primary/30',
            pulse: ''
        }
    }

    const config = statusConfig[status]

    if (status === 'chequered') {
        return (
            <div className="inline-flex items-center justify-center rounded px-2.5 py-1 border bg-fg-primary/10 shadow-lg backdrop-blur-md">
                <div className="grid grid-cols-4 gap-[1px] w-6 h-4 transform skew-x-[-10deg]">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-full h-full ${i % 2 === Math.floor(i / 4) % 2 ? 'bg-fg-primary shadow-sm' : 'bg-bg-void'}`}
                        />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <span
            className={`inline-flex items-center justify-center rounded-sm px-3 py-1 text-xs font-heading font-black uppercase tracking-widest border ${config.bgClass} ${config.textClass} ${config.borderClass} ${config.pulse} backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.5)] transform italic`}
        >
            {config.label}
        </span>
    )
})

export const PanelShell = React.memo(function PanelShell({
    title,
    actions,
    loading,
    error,
    children
}: {
    title?: string
    actions?: ReactNode
    loading?: boolean
    error?: string | null
    children: ReactNode
}) {
    if (loading) {
        return (
            <div className="panel-border rounded-xl p-5 w-full relative group">
                {title && (
                    <div className="mb-5 flex items-center justify-between">
                        <div className="h-5 w-32 rounded bg-border-soft animate-pulse" />
                        <div className="h-5 w-16 rounded bg-border-soft animate-pulse" />
                    </div>
                )}
                <div className="space-y-4">
                    <div className="h-4 w-full rounded bg-border-micro animate-pulse" />
                    <div className="h-4 w-3/4 rounded bg-border-micro animate-pulse delay-75" />
                    <div className="h-4 w-5/6 rounded bg-border-micro animate-pulse delay-150" />
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="panel-border rounded-xl p-5 w-full border-red-core/30 shadow-[0_0_20px_rgba(225,6,0,0.1)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-red-core/5 pointer-events-none" />
                {title && (
                    <div className="mb-5 flex items-center justify-between border-b border-border/50 pb-3 relative z-10">
                        <span className="font-heading text-[15px] font-bold text-fg-primary tracking-wide drop-shadow-sm">{title}</span>
                    </div>
                )}
                <div className="error-state rounded-lg p-5 bg-bg-raised/80 backdrop-blur border border-red-core/20 flex flex-col items-center justify-center gap-3 relative z-10">
                    <div className="text-red-core text-3xl drop-shadow-md animate-pulse">⚠</div>
                    <div className="text-red-core/80 font-mono text-sm tracking-tight text-center max-w-sm">{error}</div>
                </div>
            </div>
        )
    }

    return (
        <div className="panel-border rounded-xl p-5 w-full relative group shadow-deep transition-all duration-300">
            {title && (
                <div className="mb-5 flex items-center justify-between border-b border-border/50 pb-3 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-4 bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
                        <span className="font-heading text-[15px] font-bold text-fg-primary tracking-widest drop-shadow-sm uppercase">{title}</span>
                    </div>
                    {actions && <div className="flex items-center gap-2.5 opacity-80 hover:opacity-100 transition-opacity">{actions}</div>}
                </div>
            )}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    )
})
