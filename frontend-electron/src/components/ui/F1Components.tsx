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
            textClass: 'text-[#E10600]',
            bgClass: 'bg-[#E10600]/10',
            borderClass: 'border-[#E10600]/30'
        },
        out: {
            label: 'OUT',
            textClass: 'text-[#FFB800]',
            bgClass: 'bg-[#FFB800]/10',
            borderClass: 'border-[#FFB800]/30'
        },
        dns: {
            label: 'DNS',
            textClass: 'text-[#8A8A96]',
            bgClass: 'bg-[#8A8A96]/10',
            borderClass: 'border-[#8A8A96]/30'
        },
        pit: {
            label: 'PIT',
            textClass: 'text-[#FF9600]',
            bgClass: 'bg-[#FF9600]/10',
            borderClass: 'border-[#FF9600]/30'
        },
        fl: {
            label: 'FL',
            textClass: 'text-[#B138FF]',
            bgClass: 'bg-[#B138FF]/10',
            borderClass: 'border-[#B138FF]/30'
        },
        racing: {
            label: '',
            textClass: 'text-[#E10600]',
            bgClass: 'bg-transparent',
            borderClass: 'border-transparent'
        }
    }

    const config = statusConfig[status]

    if (status === 'racing') {
        return (
            <span className="font-mono text-sm font-bold text-[#E10600]">
                {pits > 0 ? `P${pits}` : 'R'}
            </span>
        )
    }

    return (
        <span
            className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-heading font-bold uppercase tracking-wider ${config.textClass} ${config.bgClass} ${config.borderClass} border`}
        >
            {config.label}
            {status === 'fl' && (
                <span className="ml-1 text-[10px] opacity-70">FL</span>
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
        <div className="inline-flex items-center gap-1.5 font-mono text-sm">
            <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: config.color }}
            />
            <span className="font-heading text-xs font-semibold uppercase text-fg-secondary">
                {compound}
            </span>
            <span className="text-fg-primary font-bold">{laps}</span>
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
        lg: '14px'
    }

    const trendConfig = {
        gaining: { symbol: '▲', color: '#00FF00' },
        losing: { symbol: '▼', color: '#FF2D2D' },
        stable: { symbol: '▶', color: '#8A8A96' }
    }

    const config = trendConfig[trend]

    return (
        <span
            className="inline-flex items-center"
            style={{ fontSize: sizeMap[size], color: config.color, lineHeight: 1 }}
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
        sm: '4px',
        md: '6px',
        lg: '8px'
    }

    const glowSize = {
        sm: '4px',
        md: '6px',
        lg: '8px'
    }

    if (!active) {
        return (
            <span
                className="rounded-full bg-[#333333]"
                style={{
                    width: sizeMap[size],
                    height: sizeMap[size]
                }}
            />
        )
    }

    return (
        <span
            className="rounded-full"
            style={{
                width: sizeMap[size],
                height: sizeMap[size],
                backgroundColor: '#FF9600',
                boxShadow: `0 0 ${glowSize[size]} rgba(255,150,0,0.8)`
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
        <div className="rounded-lg border border-red-core/30 bg-red-core/10 p-4">
            <div className="flex items-start gap-3">
                <span className="text-xl text-red-core">⚠</span>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-heading text-sm font-bold text-red-core">
                            {code}
                        </span>
                    </div>
                    <p className="mt-1 font-mono text-sm text-fg-primary">
                        {message}
                    </p>
                    {detail && (
                        <p className="mt-2 font-mono text-xs text-fg-secondary">
                            {detail}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
})
