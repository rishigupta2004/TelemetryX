import React from 'react'

export const StatusBadge = React.memo(function StatusBadge({
    status,
    pits = 0
}: {
    status: 'dnf' | 'out' | 'dns' | 'pit' | 'fl' | 'racing'
    pits?: number
}) {
    const statusConfig = {
        dnf: {
            label: 'DNF',
            textClass: 'text-[#E10600] drop-shadow-[0_0_8px_rgba(225,6,0,0.6)]',
            bgClass: 'bg-[#E10600]/10 backdrop-blur-sm',
            borderClass: 'border-[#E10600]/40 shadow-[0_4px_12px_rgba(225,6,0,0.15)]'
        },
        out: {
            label: 'OUT',
            textClass: 'text-[#FFB800] drop-shadow-[0_0_8px_rgba(255,184,0,0.6)]',
            bgClass: 'bg-[#FFB800]/10 backdrop-blur-sm',
            borderClass: 'border-[#FFB800]/40 shadow-[0_4px_12px_rgba(255,184,0,0.15)]'
        },
        dns: {
            label: 'DNS',
            textClass: 'text-[#8A8A96] drop-shadow-[0_0_4px_rgba(138,138,150,0.4)]',
            bgClass: 'bg-[#8A8A96]/10 backdrop-blur-sm',
            borderClass: 'border-[#8A8A96]/40 shadow-sm'
        },
        pit: {
            label: 'PIT',
            textClass: 'text-[#FF9600] drop-shadow-[0_0_8px_rgba(255,150,0,0.6)]',
            bgClass: 'bg-[#FF9600]/10 backdrop-blur-sm',
            borderClass: 'border-[#FF9600]/40 shadow-[0_4px_12px_rgba(255,150,0,0.15)] animate-pulse'
        },
        fl: {
            label: 'FL',
            textClass: 'text-[#B138FF] drop-shadow-[0_0_8px_rgba(177,56,255,0.6)]',
            bgClass: 'bg-[#B138FF]/10 backdrop-blur-sm',
            borderClass: 'border-[#B138FF]/40 shadow-[0_4px_12px_rgba(177,56,255,0.15)]'
        },
        racing: {
            label: '',
            textClass: 'text-[#E10600] drop-shadow-sm',
            bgClass: 'bg-transparent',
            borderClass: 'border-transparent'
        }
    }

    const config = statusConfig[status]

    if (status === 'racing') {
        return (
            <span className="font-mono text-[13px] font-black tracking-widest text-[#E10600] drop-shadow-[0_0_6px_rgba(225,6,0,0.4)] transition-all duration-300">
                {pits > 0 ? `P${pits}` : 'R'}
            </span>
        )
    }

    return (
        <span
            className={`inline-flex items-center justify-center rounded-sm px-2.5 py-1 text-[11px] font-heading font-black uppercase tracking-widest ${config.textClass} ${config.bgClass} ${config.borderClass} border transition-all duration-300`}
        >
            {config.label}
            {status === 'fl' && (
                <span className="ml-[4px] text-[9px] font-ui opacity-80 tracking-normal italic leading-none">FASTEST LAP</span>
            )}
        </span>
    )
})

export const TyreChip = React.memo(function TyreChip({
    compound,
    laps
}: {
    compound: 'S' | 'M' | 'H' | 'I' | 'W' | 'U' | '?'
    laps: number
}) {
    const compoundConfig = {
        S: { color: '#FF3333', label: 'Soft' },
        M: { color: '#FFDD00', label: 'Medium' },
        H: { color: '#FFFFFF', label: 'Hard' },
        I: { color: '#33FF33', label: 'Inter' },
        W: { color: '#0066FF', label: 'Wet' },
        U: { color: '#666666', label: 'Unknown' },
        '?': { color: '#666666', label: 'Unknown' }
    }

    const config = compoundConfig[compound] || compoundConfig['?']

    return (
        <div className="inline-flex items-center gap-2 font-mono text-sm bg-bg-panel/40 px-2 py-1 rounded border border-border-soft backdrop-blur shadow-sm group hover:border-border-hard transition-colors duration-200">
            <span
                className="h-2.5 w-2.5 rounded-full ring-1 ring-offset-1 ring-offset-bg-panel shadow-[0_0_6px_rgba(255,255,255,0.2)]"
                style={{ backgroundColor: config.color, '--tw-ring-color': config.color } as React.CSSProperties}
            />
            <span className="font-heading text-[11px] font-bold uppercase tracking-widest text-fg-secondary group-hover:text-fg-primary transition-colors">
                {compound}
            </span>
            <span className="text-fg-primary font-black drop-shadow w-4 text-right">{laps}</span>
        </div>
    )
})

export const DeltaArrow = React.memo(function DeltaArrow({
    trend,
    size = 'md'
}: {
    trend: 'gaining' | 'losing' | 'stable'
    size?: 'sm' | 'md' | 'lg'
}) {
    const sizeMap = {
        sm: '10px',
        md: '12px',
        lg: '16px'
    }

    const trendConfig = {
        gaining: { symbol: '▲', color: '#00FF00', shadow: 'rgba(0,255,0,0.5)' },
        losing: { symbol: '▼', color: '#FF2D2D', shadow: 'rgba(255,45,45,0.5)' },
        stable: { symbol: '▶', color: '#8A8A96', shadow: 'rgba(138,138,150,0.3)' }
    }

    const config = trendConfig[trend]

    return (
        <span
            className="inline-flex items-center font-black transition-all duration-300"
            style={{ 
              fontSize: sizeMap[size], 
              color: config.color, 
              lineHeight: 1,
              textShadow: `0 0 8px ${config.shadow}`
            }}
        >
            {config.symbol}
        </span>
    )
})

export const DRSIndicator = React.memo(function DRSIndicator({
    active,
    size = 'md'
}: {
    active: boolean
    size?: 'sm' | 'md' | 'lg'
}) {
    const sizeMap = {
        sm: '5px',
        md: '7px',
        lg: '10px'
    }

    const glowSize = {
        sm: '6px',
        md: '10px',
        lg: '16px'
    }

    if (!active) {
        return (
            <span
                className="rounded-full bg-border-hard shadow-inner transition-colors duration-500"
                style={{
                    width: sizeMap[size],
                    height: sizeMap[size]
                }}
            />
        )
    }

    return (
        <span
            className="rounded-full animate-[pulse-glow_2s_infinite] transition-all duration-500"
            style={{
                width: sizeMap[size],
                height: sizeMap[size],
                backgroundColor: '#FF9600',
                boxShadow: `0 0 ${glowSize[size]} rgba(255,150,0,0.9)`
            }}
        />
    )
})

export const ErrorBanner = React.memo(function ErrorBanner({
    error
}: {
    error: { error?: string; code?: string; message?: string; detail?: string } | string
}) {
    const getErrorContent = () => {
        if (typeof error === 'string') {
            return {
                code: 'ERROR',
                message: error,
                detail: undefined
            }
        }

        return {
            code: error.code || error.error || 'ERROR',
            message: error.message || 'An unknown error occurred',
            detail: error.detail
        }
    }

    const { code, message, detail } = getErrorContent()

    return (
        <div className="rounded-xl border border-red-core/40 bg-red-core/5 backdrop-blur-md p-5 shadow-[0_8px_32px_rgba(225,6,0,0.15)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-core shadow-[0_0_12px_#e10600]" />
            <div className="flex items-start gap-4 relative z-10">
                <span className="text-3xl text-red-core drop-shadow-[0_0_8px_rgba(225,6,0,0.5)] animate-pulse flex-shrink-0">⚠</span>
                <div className="flex-1 mt-1">
                    <div className="flex items-center gap-2">
                        <span className="font-heading text-sm font-black tracking-widest text-red-core uppercase">
                            {code}
                        </span>
                    </div>
                    <p className="mt-2 font-mono text-sm font-medium leading-relaxed text-fg-primary opacity-90">
                        {message}
                    </p>
                    {detail && (
                        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-fg-secondary/70 bg-bg-void/50 p-2 rounded border border-red-core/10 inline-block">
                            {detail}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
})
