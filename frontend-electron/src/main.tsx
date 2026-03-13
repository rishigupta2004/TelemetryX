import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider, useAuth, useClerk } from '@clerk/react'
import App from './App'
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary'
import { AuthGate } from './components/AuthGate'
import { setAuthToken } from './lib/authToken'
import './index.css'

const clerkPublishableKey = (import.meta as unknown as { env?: { VITE_CLERK_PUBLISHABLE_KEY?: string } })?.env?.VITE_CLERK_PUBLISHABLE_KEY

function ClerkTokenBridge() {
  const { isSignedIn, getToken } = useAuth()

  React.useEffect(() => {
    let active = true
    if (!isSignedIn) {
      setAuthToken(null)
      return
    }
    void getToken().then((token) => {
      if (!active) return
      setAuthToken(token ?? null)
    })
    return () => {
      active = false
    }
  }, [isSignedIn, getToken])

  return null
}

function AppAuthBridge() {
  const clerk = useClerk()

  return (
    <App onSignOut={() => clerk.signOut()} />
  )
}

function MissingClerkKey() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
      <div className="rounded-xl border border-border-hard bg-bg-surface p-6 text-sm text-fg-secondary">
        Missing `VITE_CLERK_PUBLISHABLE_KEY`. OAuth login cannot start.
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
        <ClerkTokenBridge />
        <GlobalErrorBoundary>
          <AuthGate>
            <AppAuthBridge />
          </AuthGate>
        </GlobalErrorBoundary>
      </ClerkProvider>
    ) : (
      <MissingClerkKey />
    )}
  </React.StrictMode>
)
