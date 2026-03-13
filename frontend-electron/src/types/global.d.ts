export {}

declare global {
  interface Window {
    telemetryx?: {
      apiBaseUrl?: string | null
      apiToken?: string | null
      platform?: string
      isPackaged?: boolean
      versions?: {
        electron?: string
        chrome?: string
        node?: string
      }
    }
  }
}
