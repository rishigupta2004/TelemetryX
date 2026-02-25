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
                    className="skeleton-shimmer rounded-lg"
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
                <div className="skeleton-shimmer h-4 w-40 rounded" />
                <div className="skeleton-shimmer h-6 w-24 rounded-lg" />
            </div>

            {/* Content area */}
            <div className="flex min-h-0 flex-1 gap-4">
                {/* Left panel */}
                <div className="flex min-w-[300px] flex-[1.1] flex-col gap-3">
                    {Array.from({ length: 8 }, (_, i) => (
                        <div
                            key={i}
                            className="skeleton-shimmer rounded-lg"
                            style={{
                                height: '32px',
                                animationDelay: `${i * 0.08}s`
                            }}
                        />
                    ))}
                </div>

                {/* Right panel */}
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="skeleton-shimmer min-h-0 flex-1 rounded-2xl" style={{ animationDelay: '0.2s' }} />
                    <div className="flex h-[200px] gap-3">
                        <div className="skeleton-shimmer w-[280px] rounded-xl" style={{ animationDelay: '0.35s' }} />
                        <div className="skeleton-shimmer flex-1 rounded-xl" style={{ animationDelay: '0.5s' }} />
                    </div>
                </div>
            </div>
        </div>
    )
})
