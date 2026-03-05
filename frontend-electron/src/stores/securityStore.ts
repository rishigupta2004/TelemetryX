import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Security roles in ascending order of access */
export type SecurityRole = 'GUEST' | 'ANALYST' | 'ENGINEER' | 'ADMIN'

export interface SecurityLevelConfig {
    role: SecurityRole
    label: string
    description: string
    color: string
    icon: string
    /** Views accessible at this level (cumulative upward) */
    views: string[]
    /** SHA-256 hex digest of the PIN */
    pinHash: string
}

/**
 * Pre-computed SHA-256 hashes of PINs so plaintext PINs never appear in code.
 * Generated via: echo -n "XXXX" | shasum -a 256
 */
/** Ordered levels — index 0 = lowest access */
export const SECURITY_LEVELS: SecurityLevelConfig[] = [
    {
        role: 'GUEST',
        label: 'Guest',
        description: 'Live timing & track map only',
        color: '#6b7280',
        icon: '👁',
        views: ['timing', 'track'],
        // SHA-256("0000")
        pinHash: '9af15b336e6a9619928331a2571e835c18f9419cf35e5420bc04c34f8ceb3a25'
    },
    {
        role: 'ANALYST',
        label: 'Analyst',
        description: 'Timing, Track, Telemetry & Analytics',
        color: '#3b82f6',
        icon: '📊',
        views: ['timing', 'track', 'telemetry', 'analytics', 'standings'],
        // SHA-256("1234")
        pinHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
    },
    {
        role: 'ENGINEER',
        label: 'Engineer',
        description: 'Full data access excl. admin',
        color: '#f59e0b',
        icon: '⚙️',
        views: ['timing', 'track', 'telemetry', 'strategy', 'analytics', 'standings', 'profiles', 'fia_documents'],
        // SHA-256("5678")
        pinHash: '1130802bf25753a5dd24a9debc0411025c94ffa4a2c4a2e7cbb15dfed2b5ef7b'
    },
    {
        role: 'ADMIN',
        label: 'Admin',
        description: 'Unrestricted access',
        color: '#e10600',
        icon: '🔑',
        views: ['timing', 'track', 'telemetry', 'strategy', 'features', 'analytics', 'standings', 'profiles', 'fia_documents'],
        // SHA-256("9999")
        pinHash: 'fe710b329cc2261e3e6bf56d96e4571a7a0feb4513bdadac52e57a3acca6f2f9'
    }
]

/** Hash a PIN string using SHA-256 and return hex digest */
async function hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(pin)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface SecurityState {
    role: SecurityRole
    /** Whether the security lock modal is open */
    lockModalOpen: boolean
    /** PIN digits being entered */
    pinBuffer: string[]
    pinError: string | null
    openLockModal: () => void
    closeLockModal: () => void
    appendPin: (digit: string) => void
    clearPin: () => void
    submitPin: () => void
    hasAccess: (view: string) => boolean
    currentConfig: () => SecurityLevelConfig
    setRole: (role: SecurityRole) => void
}

export const useSecurityStore = create<SecurityState>()(
    persist(
        (set, get) => ({
            role: 'ADMIN', // default to ADMIN so nothing is locked on first launch
            lockModalOpen: false,
            pinBuffer: [],
            pinError: null,

            openLockModal: () => set({ lockModalOpen: true, pinBuffer: [], pinError: null }),
            closeLockModal: () => set({ lockModalOpen: false, pinBuffer: [], pinError: null }),

            appendPin: (digit) => {
                const current = get().pinBuffer
                if (current.length >= 4) return
                const next = [...current, digit]
                set({ pinBuffer: next, pinError: null })

                // Auto-submit when 4 digits entered
                if (next.length === 4) {
                    setTimeout(() => get().submitPin(), 120)
                }
            },

            clearPin: () => set({ pinBuffer: [], pinError: null }),

            submitPin: () => {
                const pin = get().pinBuffer.join('')
                // Hash the entered PIN and compare against stored hashes
                void hashPin(pin).then((hash) => {
                    const matched = SECURITY_LEVELS.find((l) => l.pinHash === hash)
                    if (!matched) {
                        set({ pinError: 'Incorrect PIN', pinBuffer: [] })
                        return
                    }
                    set({ role: matched.role, lockModalOpen: false, pinBuffer: [], pinError: null })
                })
            },

            hasAccess: (view) => {
                const config = get().currentConfig()
                return config.views.includes(view)
            },

            currentConfig: () => {
                const role = get().role
                return SECURITY_LEVELS.find((l) => l.role === role) ?? SECURITY_LEVELS[3]
            },

            setRole: (role) => set({ role })
        }),
        {
            name: 'telemetryx-security',
            partialize: (s) => ({ role: s.role })
        }
    )
)
