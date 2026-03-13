import type { ReactNode } from 'react'

interface EmptyStateProps {
    icon?: ReactNode
    title: string
    detail?: string
    action?: { label: string; onClick: () => void }
    variant?: 'muted' | 'error' | 'loading' | 'success'
    className?: string
}

export function EmptyState({
    icon,
    title,
    detail,
    action,
    variant = 'muted',
    className = ''
}: EmptyStateProps): ReactNode {
    const variantClasses = {
        muted: {
            container: 'empty-state',
            icon: 'empty-state-icon',
            title: 'empty-state-title',
            detail: 'empty-state-detail',
            defaultIcon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12h8M12 8v8" />
                </svg>
            )
        },
        error: {
            container: 'error-state',
            icon: 'error-state-icon',
            title: 'error-state-title',
            detail: 'error-state-detail',
            defaultIcon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M15 9l-6 6M9 9l6 6" />
                </svg>
            )
        },
        loading: {
            container: 'flex items-center justify-center p-8',
            icon: 'flex items-center justify-center',
            title: 'empty-state-title',
            detail: 'empty-state-detail',
            defaultIcon: (
                <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-fg-muted border-t-red-core" />
            )
        },
        success: {
            container: 'success-state',
            icon: 'success-state-icon',
            title: 'success-state-title',
            detail: 'empty-state-detail',
            defaultIcon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9 12l2 2 4-4" />
                </svg>
            )
        }
    }

    const styles = variantClasses[variant]

    if (variant === 'loading') {
        return (
            <div className={`${styles.container} flex-col gap-3 ${className}`}>
                <div className={styles.icon}>
                    {icon || styles.defaultIcon}
                </div>
                <div className={styles.title}>{title}</div>
                {detail && <div className={styles.detail}>{detail}</div>}
            </div>
        )
    }

    return (
        <div className={`${styles.container} ${className}`}>
            <div className={styles.icon}>
                {icon || styles.defaultIcon}
            </div>
            <div className={styles.title}>{title}</div>
            {detail && <div className={styles.detail}>{detail}</div>}
            {action && (
                <button
                    type="button"
                    onClick={action.onClick}
                    className="mt-2 rounded-lg border border-border-soft bg-bg-elevated px-4 py-2 text-xs font-semibold text-fg-secondary transition-all duration-200 hover:border-red-core/50 hover:bg-bg-surface hover:text-fg-primary hover:shadow-md micro-press"
                >
                    {action.label}
                </button>
            )}
        </div>
    )
}

/* ── Compact inline empty state for lists/tables ── */

export function InlineEmptyState({
    message,
    className = ''
}: {
    message?: string
    className?: string
}): ReactNode {
    return (
        <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`}>
            <div className="mb-2 text-fg-muted">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-50">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12h8" />
                </svg>
            </div>
            <p className="text-sm text-fg-muted">{message || 'No data available'}</p>
        </div>
    )
}

/* ── Inline error state for lists/tables ── */

export function InlineErrorState({
    message,
    onRetry,
    className = ''
}: {
    message?: string
    onRetry?: () => void
    className?: string
}): ReactNode {
    return (
        <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`}>
            <div className="mb-2 text-red-danger">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M15 9l-6 6M9 9l6 6" />
                </svg>
            </div>
            <p className="mb-3 text-sm text-red-300">{message || 'Failed to load data'}</p>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="rounded-md bg-red-danger/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-all duration-200 hover:bg-red-danger/30 hover:text-red-200"
                >
                    Try Again
                </button>
            )}
        </div>
    )
}

/* ── Loading overlay for content areas ── */

export function LoadingOverlay({
    message = 'Loading...',
    className = ''
}: {
    message?: string
    className?: string
}): ReactNode {
    return (
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-base/80 backdrop-blur-sm ${className}`}>
            <div className="relative">
                <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-fg-ghost border-t-red-core" />
                <div className="absolute inset-0 rounded-full border-2 border-red-core/20 animate-ping" />
            </div>
            <p className="text-sm text-fg-muted animate-pulse">{message}</p>
        </div>
    )
}
