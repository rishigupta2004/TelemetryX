import type { ReactNode } from 'react'

interface EmptyStateProps {
    /** Optional icon or symbol to display */
    icon?: ReactNode
    /** Primary message */
    title: string
    /** Secondary explanation */
    detail?: string
    /** Optional action button */
    action?: { label: string; onClick: () => void }
    /** Visual variant */
    variant?: 'muted' | 'error' | 'loading'
}

export function EmptyState({
    icon,
    title,
    detail,
    action,
    variant = 'muted'
}: EmptyStateProps): ReactNode {
    const accentClass =
        variant === 'error'
            ? 'border-red-500/20 bg-red-500/5'
            : variant === 'loading'
                ? 'border-border/40 bg-bg-card/30'
                : 'border-border/40 bg-bg-card/20'

    const titleClass =
        variant === 'error' ? 'text-red-300' : 'text-text-secondary'

    const detailClass =
        variant === 'error' ? 'text-red-300/70' : 'text-text-muted'

    return (
        <div className={`flex h-full flex-col items-center justify-center gap-3 rounded-xl border p-6 ${accentClass}`}>
            {variant === 'loading' ? (
                <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-text-secondary border-t-transparent" />
            ) : icon ? (
                <div className="text-2xl text-text-muted">{icon}</div>
            ) : null}
            <div className="text-center">
                <div className={`text-sm font-medium ${titleClass}`}>{title}</div>
                {detail && (
                    <div className={`mt-1 max-w-sm text-xs ${detailClass}`}>{detail}</div>
                )}
            </div>
            {action && (
                <button
                    type="button"
                    onClick={action.onClick}
                    className="mt-1 rounded-lg border border-border bg-bg-secondary px-4 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
                >
                    {action.label}
                </button>
            )}
        </div>
    )
}
