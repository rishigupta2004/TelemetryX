/// <reference types="vite/client" />

import type { useUser as UseUserType, useAuth as UseAuthType } from '@clerk/react'
import { useUser, useAuth } from '@clerk/react'

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

const HAS_CLERK = !!(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

export const AUTH_ENABLED = HAS_CLERK

// Guest user (when auth is disabled)
const useGuestUser = () => ({ 
  user: null, 
  isLoaded: true, 
  isSignedIn: false 
} as const)

// Authenticated user (when Clerk is enabled)
const useClerkUser = () => useUser()

// Export the appropriate hook based on AUTH_ENABLED
// This is safe because AUTH_ENABLED is constant at module load time
export const useCurrentUser = AUTH_ENABLED ? useClerkUser : useGuestUser

// Guest auth
const useGuestAuth = () => ({
  userId: null,
  isLoaded: true, 
  isSignedIn: false,
  getToken: async () => null
} as const)

// Authenticated auth
const useClerkAuth = () => useAuth()

export const useCurrentAuth = AUTH_ENABLED ? useClerkAuth : useGuestAuth

// Gate component — renders children only when signed in
export const AuthGate = ({ 
  children, 
  fallback = null 
}: { 
  children: React.ReactNode
  fallback?: React.ReactNode 
}) => {
  if (!AUTH_ENABLED) return <>{children}</>
  
  const { isSignedIn } = useUser()
  return isSignedIn ? <>{children}</> : <>{fallback}</>
}
