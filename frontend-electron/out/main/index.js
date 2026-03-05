import { app, nativeTheme, BrowserWindow, session } from "electron";
import { join } from "node:path";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const isDev = !app.isPackaged;
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("enable-hardware-overlays", "single-fullscreen,single-on-top,underlay");
app.commandLine.appendSwitch("disable-gpu-vsync");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-features", "VaapiVideoDecoder,VaapiVideoEncoder,CanvasOopRasterization");
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=512 --optimize-for-size");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
nativeTheme.themeSource = "dark";
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    title: "TelemetryX",
    backgroundColor: "#0a0a0a",
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 12, y: 14 } : void 0,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: join(__dirname, "../preload/preload.mjs"),
      backgroundThrottling: false,
      // no throttling during playback
      spellcheck: false,
      // unnecessary for data app
      enableWebSQL: false
      // unused — save memory
    }
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://localhost:* ws://localhost:*; img-src 'self' data: blob:;"
          ]
        }
      });
    });
  }
  mainWindow.on("close", () => {
    try {
      const bounds = mainWindow.getBounds();
      const isMaximized = mainWindow.isMaximized();
      const data = JSON.stringify({ bounds, isMaximized });
      require2("node:fs").writeFileSync(
        join(app.getPath("userData"), "window-state.json"),
        data,
        "utf-8"
      );
    } catch {
    }
  });
  try {
    const stateFile = join(app.getPath("userData"), "window-state.json");
    const data = JSON.parse(require2("node:fs").readFileSync(stateFile, "utf-8"));
    if (data.bounds) {
      mainWindow.setBounds(data.bounds);
    }
    if (data.isMaximized) {
      mainWindow.maximize();
    }
  } catch {
  }
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
  } else if (isDev) {
    void mainWindow.loadURL("http://localhost:5173");
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", () => {
});
