import React, { useMemo } from 'react'
import { useClerk } from '@clerk/react'
import { AUTH_ENABLED, useCurrentAuth } from '../lib/auth'

interface AuthGateProps {
  children: React.ReactNode
}

function ClerkSignInButton() {
  const clerk = useClerk()
  return (
    <button
      type="button"
      className="w-full rounded-lg bg-red-core px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      onClick={() => clerk.openSignIn()}
    >
      Continue with OAuth
    </button>
  )
}

export function AuthGate({ children }: AuthGateProps) {
  // Use safe auth hook that never throws
  const { isLoaded, isSignedIn } = useCurrentAuth()

  // If auth is disabled, always render children
  if (!AUTH_ENABLED) {
    return <>{children}</>
  }

  const callbackUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'http://localhost:5173'
    return `${window.location.origin}/`
  }, [])

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        <div className="text-sm tracking-wide text-fg-secondary">Initializing Clerk...</div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black p-6 text-white">
        <div className="w-full max-w-md rounded-2xl border border-border-hard bg-bg-surface p-6">
          <div className="mb-4 text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            Sign in to TelemetryX
          </div>
          <div className="mb-6 text-sm text-fg-secondary">
            OAuth is now powered by Clerk. Continue with Google to access the app.
          </div>
          <ClerkSignInButton />
          <div className="mt-3 text-[11px] text-fg-muted">
            Configure Clerk redirect URL to <span className="font-mono text-fg-secondary">{callbackUrl}</span>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
