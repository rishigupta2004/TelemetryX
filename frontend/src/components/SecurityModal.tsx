import React, { useEffect, useCallback } from 'react'
import { useSecurityStore, SECURITY_LEVELS } from '../stores/securityStore'

function PinDot({ filled }: { filled: boolean }) {
    return (
        <div
            className="h-3.5 w-3.5 rounded-full border-2 transition-all duration-150"
            style={{
                borderColor: filled ? '#e10600' : 'rgba(255,255,255,0.2)',
                background: filled ? '#e10600' : 'transparent',
                boxShadow: filled ? '0 0 10px rgba(225,6,0,0.6)' : 'none',
                transform: filled ? 'scale(1.15)' : 'scale(1)'
            }}
        />
    )
}

export const SecurityModal = React.memo(function SecurityModal() {
    const lockModalOpen = useSecurityStore((s) => s.lockModalOpen)
    const pinBuffer = useSecurityStore((s) => s.pinBuffer)
    const pinError = useSecurityStore((s) => s.pinError)
    const currentRole = useSecurityStore((s) => s.role)
    const appendPin = useSecurityStore((s) => s.appendPin)
    const clearPin = useSecurityStore((s) => s.clearPin)
    const closeLockModal = useSecurityStore((s) => s.closeLockModal)
    const currentConfig = useSecurityStore((s) => s.currentConfig)

    const config = currentConfig()

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!lockModalOpen) return
            if (e.key >= '0' && e.key <= '9') appendPin(e.key)
            if (e.key === 'Backspace') clearPin()
            if (e.key === 'Escape') closeLockModal()
        },
        [lockModalOpen, appendPin, clearPin, closeLockModal]
    )

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    if (!lockModalOpen) return null

    const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫']

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(12px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) closeLockModal() }}
        >
            <div
                className="w-[340px] border border-border-hard bg-bg-surface p-6 panel-border"
                style={{
                    background: 'var(--bg-base)',
                    boxShadow: 'none'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="mb-5 text-center">
                    <div className="mb-1 text-2xl">🔐</div>
                    <div className="text-base font-bold tracking-wide text-text-primary">Security Level</div>
                    <div className="mt-1 text-[11px] text-text-muted">Enter PIN to change access level</div>
                </div>

                {/* Current level badge */}
                <div className="mb-5 flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-bg-card/60 py-2">
                    <span className="text-base">{config.icon}</span>
                    <span
                        className="text-sm font-semibold"
                        style={{ color: config.color }}
                    >
                        {config.label}
                    </span>
                    <span className="text-[10px] text-text-muted">Current</span>
                </div>

                {/* Level reference */}
                <div className="mb-5 space-y-1.5">
                    {SECURITY_LEVELS.map((level) => (
                        <div
                            key={level.role}
                            className="flex items-center gap-2.5 rounded-lg border px-3 py-1.5 text-[11px] transition-all"
                            style={{
                                borderColor: currentRole === level.role ? level.color + '55' : 'rgba(255,255,255,0.06)',
                                background: currentRole === level.role ? level.color + '14' : 'rgba(255,255,255,0.02)',
                            }}
                        >
                            <span className="text-sm">{level.icon}</span>
                            <span className="w-16 font-mono font-bold" style={{ color: level.color }}>{level.label}</span>
                            <span className="flex-1 text-text-muted">{level.description}</span>
                            {currentRole === level.role && (
                                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: level.color + '30', color: level.color }}>ACTIVE</span>
                            )}
                        </div>
                    ))}
                </div>

                {/* PIN dots */}
                <div className="mb-4 flex items-center justify-center gap-3">
                    {[0, 1, 2, 3].map((i) => (
                        <PinDot key={i} filled={i < pinBuffer.length} />
                    ))}
                </div>

                {/* Error */}
                {pinError && (
                    <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-center text-[11px] font-semibold text-red-300 border border-red-500/20">
                        {pinError}
                    </div>
                )}

                {/* PIN pad */}
                <div className="grid grid-cols-3 gap-2">
                    {DIGITS.map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => {
                                if (d === 'C') { clearPin(); return }
                                if (d === '⌫') { clearPin(); return }
                                appendPin(d)
                            }}
                            className="flex h-11 items-center justify-center rounded-xl border border-border/50 text-base font-semibold text-text-primary transition-all duration-100 hover:scale-105 hover:border-accent/40 hover:bg-accent/10 active:scale-95"
                            style={{ background: 'rgba(255,255,255,0.04)', userSelect: 'none' }}
                        >
                            {d}
                        </button>
                    ))}
                </div>

                {/* Hint */}
                <div className="mt-4 text-center text-[10px] text-text-muted/60">
                    Default PINs: GUEST=0000 · ANALYST=1234 · ENGINEER=5678 · ADMIN=9999
                </div>
            </div>
        </div>
    )
})
