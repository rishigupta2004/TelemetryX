import type { ReactNode, CSSProperties, HTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes } from 'react'
import React, { useRef, useEffect, useState, useCallback } from 'react'
import { animate } from 'animejs'

/* ═══════════════════════════════════════════════════════════════════════════
   PANEL COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

export const Card = React.memo(function Card({
    children,
    className = '',
    glow = false,
    glowColor = 'blue',
    hover = false,
    onClick,
    ...props
}: {
    children: ReactNode
    className?: string
    glow?: boolean
    glowColor?: 'red' | 'blue' | 'green' | 'purple' | 'amber' | 'cyan'
    hover?: boolean
    onClick?: () => void
} & HTMLAttributes<HTMLDivElement>) {
    const glowClass = glow ? `glow-${glowColor}` : ''
    const hoverClass = hover ? 'interaction-lift-glow cursor-pointer' : ''
    const clickableClass = onClick ? 'cursor-pointer' : ''

    return (
        <div
            className={`panel-premium rounded-xl p-4 ${glowClass} ${hoverClass} ${clickableClass} ${className}`}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
            {...props}
        >
            {children}
        </div>
    )
})

export const GlassCard = React.memo(function GlassCard({
    children,
    className = '',
    elevated = false,
    ...props
}: {
    children: ReactNode
    className?: string
    elevated?: boolean
} & HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`${elevated ? 'glass-elevated' : 'glass-premium'} rounded-xl p-4 ${className}`}
            {...props}
        >
            {children}
        </div>
    )
})

export const StatCard = React.memo(function StatCard({
    label,
    value,
    unit,
    trend,
    trendValue,
    icon,
    className = '',
    accentColor = 'blue'
}: {
    label: string
    value: string | number
    unit?: string
    trend?: 'up' | 'down' | 'neutral'
    trendValue?: string
    icon?: ReactNode
    className?: string
    accentColor?: 'red' | 'blue' | 'green' | 'purple' | 'amber' | 'cyan'
}) {
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
        <div className={`panel-premium-soft rounded-xl p-4 ${className}`}>
            <div className="flex items-start justify-between">
                <span className="text-col-header">{label}</span>
                {icon && <span className="text-fg-muted">{icon}</span>}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
                <span className="text-data font-bold">{value}</span>
                {unit && <span className="text-xs text-fg-muted">{unit}</span>}
            </div>
            {trend && trendValue && (
                <div className={`mt-2 flex items-center gap-1 text-xs ${trendColors[trend]}`}>
                    <span>{trendIcons[trend]}</span>
                    <span>{trendValue}</span>
                </div>
            )}
        </div>
    )
})

export const LoadingCard = React.memo(function LoadingCard({
    rows = 3,
    className = ''
}: {
    rows?: number
    className?: string
}) {
    return (
        <div className={`panel-premium rounded-xl p-4 ${className}`}>
            <div className="flex items-center gap-3 mb-4">
                <div className="skeleton-wave h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                    <div className="skeleton-wave h-3 w-3/4 rounded" />
                    <div className="skeleton-wave h-2 w-1/2 rounded" />
                </div>
            </div>
            <div className="space-y-2">
                {Array.from({ length: rows }, (_, i) => (
                    <div
                        key={i}
                        className="skeleton-wave h-2 w-full rounded"
                        style={{ width: `${60 + Math.random() * 40}%` }}
                    />
                ))}
            </div>
        </div>
    )
})

/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATION WRAPPERS
   ═══════════════════════════════════════════════════════════════════════════ */

interface AnimateInProps {
    children: ReactNode
    className?: string
    animation?: 'fadeIn' | 'slideUp' | 'slideDown' | 'scaleIn' | 'blurIn'
    delay?: number
    duration?: number
    trigger?: boolean
}

export const AnimateIn = React.memo(function AnimateIn({
    children,
    className = '',
    animation = 'fadeIn',
    delay = 0,
    duration = 400,
    trigger = true
}: AnimateInProps) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!trigger || !ref.current) return

        const animations: Record<string, object> = {
            fadeIn: { opacity: [0, 1] },
            slideUp: { opacity: [0, 1], translateY: [20, 0] },
            slideDown: { opacity: [0, 1], translateY: [-20, 0] },
            scaleIn: { opacity: [0, 1], scale: [0.95, 1] },
            blurIn: { opacity: [0, 1], filter: ['blur(8px)', 'blur(0)'] }
        }

        animate(ref.current, {
            ...animations[animation],
            duration,
            delay,
            easing: 'cubicBezier(0.16, 1, 0.3, 1)'
        })
    }, [trigger, animation, delay, duration])

    return (
        <div ref={ref} className={className} style={{ opacity: 0 }}>
            {children}
        </div>
    )
})

interface StaggerContainerProps {
    children: ReactNode
    className?: string
    staggerDelay?: number
    animation?: 'fadeIn' | 'slideUp' | 'scaleIn'
    trigger?: boolean
}

export const StaggerContainer = React.memo(function StaggerContainer({
    children,
    className = '',
    staggerDelay = 50,
    animation = 'slideUp',
    trigger = true
}: StaggerContainerProps) {
    const ref = useRef<HTMLDivElement>(null)
    const childrenArray = React.Children.toArray(children)

    useEffect(() => {
        if (!trigger || !ref.current) return

        const childElements = ref.current.children
        if (childElements.length === 0) return

        const animations: Record<string, object> = {
            fadeIn: { opacity: [0, 1] },
            slideUp: { opacity: [0, 1], translateY: [10, 0] },
            scaleIn: { opacity: [0, 1], scale: [0.95, 1] }
        }

        Array.from(childElements).forEach((el, i) => {
            animate(el as HTMLElement, {
                ...animations[animation],
                duration: 350,
                delay: i * staggerDelay,
                easing: 'cubicBezier(0.16, 1, 0.3, 1)'
            })
        })
    }, [trigger, animation, staggerDelay])

    return (
        <div ref={ref} className={className}>
            {childrenArray.map((child, i) => (
                <div key={i} style={{ opacity: 0 }}>
                    {child}
                </div>
            ))}
        </div>
    )
})

/* ═══════════════════════════════════════════════════════════════════════════
   DISPLAY COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'

interface BadgeProps {
    children: ReactNode
    variant?: BadgeVariant
    size?: 'sm' | 'md' | 'lg'
    className?: string
    pulse?: boolean
}

export const Badge = React.memo(function Badge({
    children,
    variant = 'default',
    size = 'md',
    className = '',
    pulse = false
}: BadgeProps) {
    const variantClasses: Record<BadgeVariant, string> = {
        default: 'bg-bg-elevated text-fg-secondary border-border-soft',
        success: 'bg-green-live/20 text-green-pb border-green-live/30',
        warning: 'bg-amber-warn/20 text-amber-slow border-amber-warn/30',
        danger: 'bg-red-danger/20 text-red-core border-red-danger/30',
        info: 'bg-blue-sel/20 text-blue-sel border-blue-sel/30',
        purple: 'bg-purple-sb/20 text-purple-sb border-purple-sb/30'
    }

    const sizeClasses = {
        sm: 'px-1.5 py-0.5 text-[10px]',
        md: 'px-2 py-0.5 text-xs',
        lg: 'px-2.5 py-1 text-sm'
    }

    const pulseClass = pulse ? 'animate-pulse' : ''

    return (
        <span
            className={`inline-flex items-center rounded-md border font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${pulseClass} ${className}`}
        >
            {children}
        </span>
    )
})

type IndicatorVariant = 'red' | 'green' | 'amber' | 'blue' | 'purple' | 'cyan' | 'muted'

interface IndicatorProps {
    variant?: IndicatorVariant
    size?: 'sm' | 'md' | 'lg'
    className?: string
    pulse?: boolean
    label?: string
}

export const Indicator = React.memo(function Indicator({
    variant = 'muted',
    size = 'md',
    className = '',
    pulse = false,
    label
}: IndicatorProps) {
    const variantClasses: Record<IndicatorVariant, string> = {
        red: 'bg-red-core',
        green: 'bg-green-live',
        amber: 'bg-amber-warn',
        blue: 'bg-blue-sel',
        purple: 'bg-purple-sb',
        cyan: 'bg-cyan-500',
        muted: 'bg-fg-muted'
    }

    const sizeClasses = {
        sm: 'h-1.5 w-1.5',
        md: 'h-2 w-2',
        lg: 'h-3 w-3'
    }

    const pulseClass = pulse ? `glow-pulse-${variant === 'muted' ? 'blue' : variant}` : ''

    const dot = (
        <span
            className={`rounded-full ${variantClasses[variant]} ${sizeClasses[size]} ${pulseClass} ${className}`}
        />
    )

    if (label) {
        return (
            <div className="flex items-center gap-2">
                {dot}
                <span className="text-xs text-fg-secondary">{label}</span>
            </div>
        )
    }

    return dot
})

interface DividerProps {
    orientation?: 'horizontal' | 'vertical'
    className?: string
    label?: string
}

export const Divider = React.memo(function Divider({
    orientation = 'horizontal',
    className = '',
    label
}: DividerProps) {
    if (orientation === 'vertical') {
        return <div className={`h-full w-px bg-border-soft ${className}`} />
    }

    if (label) {
        return (
            <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-border-soft" />
                <span className="text-xs text-fg-muted">{label}</span>
                <div className="h-px flex-1 bg-border-soft" />
            </div>
        )
    }

    return <div className={`h-px w-full bg-border-soft ${className}`} />
})

/* ═══════════════════════════════════════════════════════════════════════════
   INTERACTIVE COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

interface IconButtonProps {
    icon: ReactNode
    onClick?: () => void
    variant?: 'default' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    className?: string
    disabled?: boolean
    label?: string
}

export const IconButton = React.memo(function IconButton({
    icon,
    onClick,
    variant = 'default',
    size = 'md',
    className = '',
    disabled = false,
    label
}: IconButtonProps) {
    const variantClasses = {
        default: 'bg-bg-elevated border-border-soft hover:border-red-core/50 hover:bg-bg-surface',
        ghost: 'bg-transparent border-transparent hover:bg-bg-elevated',
        danger: 'bg-red-danger/10 border-red-danger/30 text-red-core hover:bg-red-danger/20'
    }

    const sizeClasses = {
        sm: 'h-7 w-7',
        md: 'h-9 w-9',
        lg: 'h-11 w-11'
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={`inline-flex items-center justify-center rounded-lg border transition-all duration-200 micro-press ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        >
            {icon}
        </button>
    )
})

interface ToggleProps {
    checked: boolean
    onChange: (checked: boolean) => void
    label?: string
    disabled?: boolean
    className?: string
}

export const Toggle = React.memo(function Toggle({
    checked,
    onChange,
    label,
    disabled = false,
    className = ''
}: ToggleProps) {
    const handleClick = () => {
        if (!disabled) {
            onChange(!checked)
        }
    }

    return (
        <label className={`inline-flex items-center gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onClick={handleClick}
                disabled={disabled}
                className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${checked ? 'bg-red-core' : 'bg-bg-elevated border border-border-soft'}`}
            >
                <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
            </button>
            {label && <span className="text-sm text-fg-secondary">{label}</span>}
        </label>
    )
})

/* ═══════════════════════════════════════════════════════════════════════════
   DATA DISPLAY COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

interface MetricDisplayProps {
    label: string
    value: string | number
    unit?: string
    trend?: {
        value: string
        direction: 'up' | 'down' | 'neutral'
    }
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

export const MetricDisplay = React.memo(function MetricDisplay({
    label,
    value,
    unit,
    trend,
    size = 'md',
    className = ''
}: MetricDisplayProps) {
    const sizeClasses = {
        sm: { label: 'text-[10px]', value: 'text-lg', unit: 'text-[10px]' },
        md: { label: 'text-xs', value: 'text-2xl', unit: 'text-xs' },
        lg: { label: 'text-sm', value: 'text-3xl', unit: 'text-sm' }
    }

    const trendColors = {
        up: 'text-green-pb',
        down: 'text-red-core',
        neutral: 'text-fg-secondary'
    }

    return (
        <div className={className}>
            <div className={`${sizeClasses[size].label} text-fg-muted uppercase tracking-wider`}>
                {label}
            </div>
            <div className={`${sizeClasses[size].value} font-bold font-mono text-fg-primary`}>
                {value}
                {unit && <span className={`${sizeClasses[size].unit} ml-1 text-fg-muted`}>{unit}</span>}
            </div>
            {trend && (
                <div className={`text-xs ${trendColors[trend.direction]}`}>
                    {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.value}
                </div>
            )}
        </div>
    )
})

interface MiniChartProps {
    data: number[]
    color?: string
    height?: number
    className?: string
    showArea?: boolean
}

export const MiniChart = React.memo(function MiniChart({
    data,
    color = 'var(--blue-sel)',
    height = 40,
    className = '',
    showArea = true
}: MiniChartProps) {
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1

    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * 100
        const y = height - ((value - min) / range) * height
        return `${x},${y}`
    }).join(' ')

    const areaPoints = `0,${height} ${points} 100,${height}`

    return (
        <svg
            viewBox={`0 0 100 ${height}`}
            preserveAspectRatio="none"
            className={`h-full w-full ${className}`}
        >
            {showArea && (
                <polygon
                    points={areaPoints}
                    fill={`${color}20`}
                />
            )}
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    )
})

interface ProgressBarProps {
    value: number
    max?: number
    color?: 'red' | 'blue' | 'green' | 'purple' | 'amber'
    showLabel?: boolean
    className?: string
    animated?: boolean
}

export const ProgressBar = React.memo(function ProgressBar({
    value,
    max = 100,
    color = 'blue',
    showLabel = false,
    className = '',
    animated = true
}: ProgressBarProps) {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    const colorClasses = {
        red: 'bg-red-core',
        blue: 'bg-blue-sel',
        green: 'bg-green-pb',
        purple: 'bg-purple-sb',
        amber: 'bg-amber-slow'
    }

    return (
        <div className={className}>
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-inset">
                <div
                    className={`h-full ${colorClasses[color]} ${animated ? 'transition-all duration-500 ease-out' : ''}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {showLabel && (
                <div className="mt-1 flex justify-between text-xs text-fg-muted">
                    <span>{value}</span>
                    <span>{max}</span>
                </div>
            )}
        </div>
    )
})

/* ═══════════════════════════════════════════════════════════════════════════
   LAYOUT COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

interface GridProps {
    children: ReactNode
    columns?: number | { base?: number; sm?: number; md?: number; lg?: number; xl?: number }
    gap?: number | string
    className?: string
}

export const Grid = React.memo(function Grid({
    children,
    columns = 2,
    gap = 4,
    className = ''
}: GridProps) {
    const getColumnClass = () => {
        if (typeof columns === 'number') {
            return `grid-cols-${columns}`
        }
        const classes: string[] = []
        if (columns.base) classes.push(`grid-cols-${columns.base}`)
        if (columns.sm) classes.push(`sm:grid-cols-${columns.sm}`)
        if (columns.md) classes.push(`md:grid-cols-${columns.md}`)
        if (columns.lg) classes.push(`lg:grid-cols-${columns.lg}`)
        if (columns.xl) classes.push(`xl:grid-cols-${columns.xl}`)
        return classes.join(' ')
    }

    const gapClass = typeof gap === 'number' ? `gap-${gap}` : gap

    return (
        <div className={`grid ${getColumnClass()} ${gapClass} ${className}`}>
            {children}
        </div>
    )
})

interface FlexProps {
    children: ReactNode
    direction?: 'row' | 'col' | 'row-reverse' | 'col-reverse'
    align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
    justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
    gap?: number | string
    wrap?: boolean
    className?: string
}

export const Flex = React.memo(function Flex({
    children,
    direction = 'row',
    align = 'center',
    justify = 'start',
    gap = 0,
    wrap = false,
    className = ''
}: FlexProps) {
    const directionClasses = {
        row: 'flex-row',
        col: 'flex-col',
        'row-reverse': 'flex-row-reverse',
        'col-reverse': 'flex-col-reverse'
    }

    const alignClasses = {
        start: 'items-start',
        center: 'items-center',
        end: 'items-end',
        stretch: 'items-stretch',
        baseline: 'items-baseline'
    }

    const justifyClasses = {
        start: 'justify-start',
        center: 'justify-center',
        end: 'justify-end',
        between: 'justify-between',
        around: 'justify-around',
        evenly: 'justify-evenly'
    }

    const gapClass = typeof gap === 'number' ? `gap-${gap}` : gap

    return (
        <div className={`flex ${directionClasses[direction]} ${alignClasses[align]} ${justifyClasses[justify]} ${wrap ? 'flex-wrap' : ''} ${gapClass} ${className}`}>
            {children}
        </div>
    )
})

/* ═══════════════════════════════════════════════════════════════════════════
   RE-EXPORTS FOR CONVENIENCE
   ═══════════════════════════════════════════════════════════════════════════ */

export { Badge as TextBadge }
