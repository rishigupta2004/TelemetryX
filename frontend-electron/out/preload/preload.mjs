import { contextBridge } from "electron";
contextBridge.exposeInMainWorld("telemetryx", {});
