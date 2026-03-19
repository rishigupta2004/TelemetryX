import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import App from './App'
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary'
import { AUTH_ENABLED, useCurrentAuth } from './lib/auth'
import { setAuthToken } from './lib/authToken'
import './index.css'

const clerkPublishableKey = (import.meta as unknown as { env?: { VITE_CLERK_PUBLISHABLE_KEY?: string } })?.env?.VITE_CLERK_PUBLISHABLE_KEY

function ClerkTokenBridge() {
  // Use safe auth hook - imported statically
  const { isSignedIn, getToken } = useCurrentAuth()

  React.useEffect(() => {
    let active = true
    if (!isSignedIn) {
      setAuthToken(null)
      return
    }
    void getToken().then((token: string | null) => {
      if (!active) return
      setAuthToken(token ?? null)
    })
    return () => {
      active = false
    }
  }, [isSignedIn, getToken])

  return null
}

function AuthenticatedApp() {
  return <App />
}

function AppWithAuth() {
  if (AUTH_ENABLED && clerkPublishableKey) {
    return (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ClerkTokenBridge />
        <GlobalErrorBoundary>
          <AuthenticatedApp />
        </GlobalErrorBoundary>
      </ClerkProvider>
    )
  }
  // No Clerk — render app directly, no provider needed
  return (
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithAuth />
  </React.StrictMode>
)
