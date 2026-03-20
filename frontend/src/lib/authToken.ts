let runtimeAuthToken: string | null = null

export function setAuthToken(token: string | null): void {
  runtimeAuthToken = token && token.trim().length > 0 ? token.trim() : null
}

export function getAuthToken(): string | null {
  if (runtimeAuthToken) return runtimeAuthToken
  const preloadToken = (
    globalThis as unknown as { telemetryx?: { apiToken?: string | null } }
  )?.telemetryx?.apiToken
  if (typeof preloadToken === 'string' && preloadToken.trim().length > 0) {
    return preloadToken.trim()
  }
  return null
}
