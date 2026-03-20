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
            const timer = setTimeout(() => setIsFlashing(false), 100)
            prevValueRef.current = value
            return () => clearTimeout(timer)
        }
    }, [value, flash])

    const sizeClasses = {
        sm: { label: 'text-[10px]', value: 'text-sm', unit: 'text-[10px]' },
        md: { label: 'text-xs', value: 'text-xl', unit: 'text-xs' },
        lg: { label: 'text-sm', value: 'text-3xl', unit: 'text-sm' }
    }

    const fontClasses = {
        orbitron: 'font-heading',
        mono: 'font-mono',
        ui: 'font-sans'
    }

    const trendColors = {
        up: 'text-green-pb',
        down: 'text-red-core',
        neutral: 'text-fg-secondary'
    }

    const trendIcons = {
        up: '↑',
        down: '↓',
        neutral: '→'
    }

    return (
        <div className="flex flex-col items-center justify-center gap-0.5">
            {label && (
                <span className={`${sizeClasses[size].label} font-ui text-fg-muted uppercase tracking-wider`}>
                    {label}
                </span>
            )}
            <div className="flex items-baseline gap-1">
                {trend && (
                    <span className={`text-xs ${trendColors[trend]}`}>
                        {trendIcons[trend]}
                    </span>
                )}
                <span className={`${sizeClasses[size].value} ${fontClasses[font]} font-bold text-fg-primary ${isFlashing ? 'animate-data-flash' : ''}`}
                      style={isFlashing ? { '--flash-color': flashColor } as React.CSSProperties : undefined}>
                    {value}
                </span>
                {unit && (
                    <span className={`${sizeClasses[size].unit} text-fg-muted`}>
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
        md: 'text-xs px-2 py-1',
        lg: 'text-sm px-3 py-1.5'
    }

    return (
        <div className="relative inline-flex items-center">
            {teamColor && (
                <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
                    style={{ backgroundColor: teamColor }}
                />
            )}
            <div
                className={`flex items-center justify-center rounded font-mono font-bold bg-bg-elevated border border-border-soft ${sizeClasses[size]}`}
                style={{ paddingLeft: teamColor ? '0.375rem' : undefined }}
            >
                {position && (
                    <span className="mr-1.5 text-fg-muted font-normal">
                        {position}.
                    </span>
                )}
                <span className="text-fg-primary">{abbreviation}</span>
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
            ? 'bg-amber-slow' 
            : 'bg-red-core'

    return (
        <div className="inline-flex items-center gap-2">
            <div className="flex items-center gap-1.5">
                <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: config.color }}
                />
                <span className="font-heading text-xs font-semibold uppercase text-fg-secondary">
                    {compound}
                </span>
                <span className="font-mono text-sm font-bold text-fg-primary">{laps}</span>
            </div>
            {degradationLevel !== undefined && (
                <div className="h-1 w-12 overflow-hidden rounded-full bg-bg-inset">
                    <div
                        className={`h-full ${degradationColor} transition-all duration-300`}
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
        if (delta < 0) return 'text-green-pb'
        if (delta > 0) return 'text-red-core'
        return 'text-fg-muted'
    }

    return (
        <span className={`font-mono text-sm font-bold ${getColor()}`}>
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
            bgClass: 'bg-green-pb/20',
            textClass: 'text-green-pb',
            borderClass: 'border-green-pb/30'
        },
        yellow: {
            label: 'YELLOW',
            bgClass: 'bg-amber-warn/20',
            textClass: 'text-amber-warn',
            borderClass: 'border-amber-warn/30'
        },
        sc: {
            label: 'SC',
            bgClass: 'bg-orange-sc/20',
            textClass: 'text-orange-sc',
            borderClass: 'border-orange-sc/30'
        },
        vsc: {
            label: 'VSC',
            bgClass: 'bg-vsc/20',
            textClass: 'text-vsc',
            borderClass: 'border-vsc/30'
        },
        red: {
            label: 'RED',
            bgClass: 'bg-red-core/20',
            textClass: 'text-red-core',
            borderClass: 'border-red-core/30'
        },
        chequered: {
            label: 'FIN',
            bgClass: 'bg-fg-primary/20',
            textClass: 'text-fg-primary',
            borderClass: 'border-fg-primary/30'
        }
    }

    const config = statusConfig[status]

    if (status === 'chequered') {
        return (
            <div className="inline-flex items-center justify-center rounded px-2 py-1 border bg-fg-primary/10">
                <div className="grid grid-cols-4 gap-0.5 w-5 h-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-1 h-1 ${i % 2 === Math.floor(i / 4) % 2 ? 'bg-fg-primary' : 'bg-bg-void'}`}
                        />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <span
            className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-heading font-bold uppercase tracking-wider border ${config.bgClass} ${config.textClass} ${config.borderClass}`}
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
            <div className="panel-premium rounded-xl p-4">
                {title && (
                    <div className="mb-4 flex items-center justify-between">
                        <div className="skeleton-wave h-5 w-32 rounded animate-loading-pulse" />
                        <div className="skeleton-wave h-5 w-16 rounded animate-loading-pulse" />
                    </div>
                )}
                <div className="space-y-3">
                    <div className="skeleton-wave h-4 w-full rounded animate-loading-pulse" />
                    <div className="skeleton-wave h-4 w-3/4 rounded animate-loading-pulse" />
                    <div className="skeleton-wave h-4 w-5/6 rounded animate-loading-pulse" />
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="panel-premium rounded-xl p-4">
                {title && (
                    <div className="mb-4 flex items-center justify-between border-b border-border-soft pb-2">
                        <span className="font-heading text-sm font-semibold text-fg-primary">{title}</span>
                    </div>
                )}
                <div className="error-state rounded-lg p-4">
                    <div className="text-red-core text-lg mb-2">⚠</div>
                    <div className="text-red-core font-mono text-sm">{error}</div>
                </div>
            </div>
        )
    }

    return (
        <div className="panel-premium rounded-xl p-4">
            {title && (
                <div className="mb-4 flex items-center justify-between border-b border-border-soft pb-2">
                    <span className="font-heading text-sm font-semibold text-fg-primary">{title}</span>
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            )}
            {children}
        </div>
    )
})
