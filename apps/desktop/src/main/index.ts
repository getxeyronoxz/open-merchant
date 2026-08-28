import { join } from "node:path";
import { BrowserWindow, app, dialog, safeStorage, shell } from "electron";
import { autoUpdater } from "electron-updater";

import { AiConfigStore } from "./ai-config";
import { MerchantService } from "./service";
import { registerIpcHandlers } from "./ipc";

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: "Open Merchant",
    backgroundColor: "#0d0f0e",
    // Packaged builds get the icon embedded in the executable; development
    // points at the source asset so the taskbar shows the mark too.
    ...(app.isPackaged
      ? {}
      : { icon: join(app.getAppPath(), "build", "icon.png") }),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on("ready-to-show", () => win.show());

  // External links open in the user's browser, never inside the app shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  // Tests point this at a temp directory so they never touch real app data.
  const customUserData = process.env.OPEN_MERCHANT_USER_DATA;
  if (customUserData) app.setPath("userData", customUserData);

  const aiConfig = new AiConfigStore(app.getPath("userData"), safeStorage);
  registerIpcHandlers(new MerchantService(app.getVersion(), aiConfig), aiConfig);
  initAutoUpdate();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/**
 * Passive update check against our own GitHub Releases feed. Nothing is
 * sent anywhere; offline or failed checks are silent and safe. Skipped in
 * development and in tests so it only ever runs inside a packaged build.
 */
function initAutoUpdate() {
  if (!app.isPackaged || process.env.OPEN_MERCHANT_USER_DATA) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-downloaded", async () => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      title: "Update ready",
      message: "A new version of Open Merchant has been downloaded.",
      detail: "Restart now to apply it, or keep working — it installs on quit.",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdates().catch(() => {
    // Offline, rate-limited, or no release yet: stay quiet.
  });
}
