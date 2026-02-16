import { contextBridge } from 'electron'

// Keep preload minimal; expose a typed bridge later if needed.
contextBridge.exposeInMainWorld('telemetryx', {})

