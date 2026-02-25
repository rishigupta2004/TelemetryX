import { contextBridge } from 'electron'

const apiBaseUrl = process.env.TELEMETRYX_API_BASE_URL ?? process.env.VITE_API_BASE_URL ?? null

contextBridge.exposeInMainWorld('telemetryx', {
  apiBaseUrl,
  platform: process.platform,
  isPackaged: !process.env.ELECTRON_IS_DEV,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
})
