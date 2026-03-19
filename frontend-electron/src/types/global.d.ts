export {}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

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
