import { contextBridge } from "electron";
const apiBaseUrl = process.env.TELEMETRYX_API_BASE_URL ?? process.env.VITE_API_BASE_URL ?? null;
contextBridge.exposeInMainWorld("telemetryx", {
  apiBaseUrl
});
