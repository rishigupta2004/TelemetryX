import React from 'react'

/* ── Reusable shimmer skeleton for lazy-loaded views ── */

interface SkeletonPanelProps {
    rows?: number
    className?: string
}

export const SkeletonPanel = React.memo(function SkeletonPanel({ rows = 4, className = '' }: SkeletonPanelProps) {
    return (
        <div className={`space-y-3 p-4 ${className}`}>
            {Array.from({ length: rows }, (_, i) => (
                <div
                    key={i}
                    className="skeleton-wave rounded-lg"
                    style={{
                        height: i === 0 ? '20px' : `${32 + Math.random() * 16}px`,
                        width: i === 0 ? '45%' : `${60 + Math.random() * 35}%`,
                        animationDelay: `${i * 0.12}s`
                    }}
                />
            ))}
        </div>
    )
})

export const ViewSkeleton = React.memo(function ViewSkeleton() {
    return (
        <div className="flex h-full w-full flex-col gap-4 p-5 xl:p-6">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div className="skeleton-wave h-4 w-40 rounded" />
                <div className="skeleton-wave h-6 w-24 rounded-lg" />
            </div>

            {/* Content area */}
            <div className="flex min-h-0 flex-1 gap-4">
                {/* Left panel */}
                <div className="flex min-w-[300px] flex-[1.1] flex-col gap-3">
                    {Array.from({ length: 8 }, (_, i) => (
                        <div
                            key={i}
                            className="skeleton-wave rounded-lg"
                            style={{
                                height: '32px',
                                animationDelay: `${i * 0.08}s`
                            }}
                        />
                    ))}
                </div>

                {/* Right panel */}
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="skeleton-wave min-h-0 flex-1 rounded-2xl" style={{ animationDelay: '0.2s' }} />
                    <div className="flex h-[200px] gap-3">
                        <div className="skeleton-wave w-[280px] rounded-xl" style={{ animationDelay: '0.35s' }} />
                        <div className="skeleton-wave flex-1 rounded-xl" style={{ animationDelay: '0.5s' }} />
                    </div>
                </div>
            </div>
        </div>
    )
})

/* ── Skeleton for specific components ── */

export const CardSkeleton = React.memo(function CardSkeleton({ className = '' }: { className?: string }) {
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
                <div className="skeleton-wave h-2 w-full rounded" />
                <div className="skeleton-wave h-2 w-5/6 rounded" />
                <div className="skeleton-wave h-2 w-4/6 rounded" />
            </div>
        </div>
    )
})

export const TableRowSkeleton = React.memo(function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
    return (
        <div className="flex items-center gap-3 py-2 px-4">
            {Array.from({ length: columns }, (_, i) => (
                <div
                    key={i}
                    className="skeleton-wave rounded"
                    style={{
                        height: '14px',
                        width: i === 0 ? '24px' : i === 1 ? '48px' : `${60 + Math.random() * 40}px`,
                        animationDelay: `${i * 0.05}s`
                    }}
                />
            ))}
        </div>
    )
})

export const ChartSkeleton = React.memo(function ChartSkeleton({ className = '' }: { className?: string }) {
    return (
        <div className={`panel-premium rounded-xl p-4 ${className}`}>
            <div className="skeleton-wave h-4 w-32 rounded mb-4" />
            <div className="skeleton-wave h-48 w-full rounded-lg" />
        </div>
    )
})

export const MiniSkeleton = React.memo(function MiniSkeleton({ className = '' }: { className?: string }) {
    return (
        <div className={`skeleton-wave rounded animate-pulse ${className}`} />
    )
})
