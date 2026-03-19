import React from 'react'
import { useSecurityStore, SECURITY_LEVELS } from '../stores/securityStore'

interface SecurityGateProps {
    view: string
    children: React.ReactNode
    /** Optional custom locked state UI instead of default */
    fallback?: React.ReactNode
}

/**
 * Wraps a view or feature and shows a locked/restricted state
 * if the current security role doesn't have access.
 */
export const SecurityGate = React.memo(function SecurityGate({
    view,
    children,
    fallback
}: SecurityGateProps) {
    const hasAccess = useSecurityStore((s) => s.hasAccess)
    const currentConfig = useSecurityStore((s) => s.currentConfig)
    const openLockModal = useSecurityStore((s) => s.openLockModal)

    if (hasAccess(view)) return <>{children}</>

    const config = currentConfig()

    // Find the minimum level needed for this view
    const minLevel = SECURITY_LEVELS.find((l: { views: string[] }) => l.views.includes(view))

    if (fallback) return <>{fallback}</>

    return (
        <div className="flex h-full flex-col items-center justify-center gap-6">
            {/* Lock icon */}
            <div
                className="flex h-20 w-20 items-center justify-center border border-border-hard bg-bg-surface text-3xl panel-border"
                style={{
                    background: 'var(--bg-surface)',
                    borderColor: 'var(--border-hard)',
                    boxShadow: 'none'
                }}
            >
                🔒
            </div>

            <div className="text-center">
                <div className="text-base font-bold text-text-primary">Restricted Access</div>
                <div className="mt-1 text-sm text-text-muted">
                    This view requires{' '}
                    <span className="font-semibold" style={{ color: minLevel?.color ?? '#e10600' }}>
                        {minLevel?.label ?? 'higher'} level
                    </span>{' '}
                    or above
                </div>
                <div className="mt-1 text-[11px] text-text-muted/60">
                    Current level: <span style={{ color: config.color }}>{config.label}</span>
                </div>
            </div>

            <button
                type="button"
                onClick={openLockModal}
                className="rounded-xl border border-border/60 bg-bg-card px-6 py-2.5 text-sm font-semibold text-text-primary transition-all hover:border-accent/40 hover:bg-accent/10 hover:text-white"
                style={{ boxShadow: '0 0 20px rgba(0,0,0,0.3)' }}
            >
                🔐 Enter PIN to Unlock
            </button>
        </div>
    )
})
