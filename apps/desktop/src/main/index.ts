import { join } from "node:path";
import { BrowserWindow, Menu, app, dialog, safeStorage, shell } from "electron";
import { autoUpdater } from "electron-updater";

import { updateStatusSchema } from "@open-merchant/shared";

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

/**
 * A deliberately slim application menu — the stock Electron menu reads as a
 * template, not a product. Edit keeps the standard roles so clipboard
 * shortcuts keep working in inputs; Help exposes the updater manually.
 */
function buildApplicationMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "Check for Updates…",
          accelerator: "CmdOrCtrl+U",
          click: () => {
            if (!app.isPackaged) {
              void dialog.showMessageBox({
                type: "info",
                title: "Updates",
                message: "Automatic updates are available in installed builds.",
                detail: `You are running the development build (${app.getVersion()}).`,
              });
              return;
            }
            autoUpdater.checkForUpdates().catch(() => {
              // Offline or no feed: the updater stays silent.
            });
          },
        },
        { type: "separator" },
        { role: "quit", label: "Quit Open Merchant" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "toggleDevTools" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Open Merchant on GitHub",
          click: () => {
            void shell.openExternal("https://github.com/getxeyronoxz/open-merchant");
          },
        },
        { type: "separator" },
        {
          label: `About Open Merchant (${app.getVersion()})`,
          click: () => {
            void dialog.showMessageBox({
              type: "info",
              title: "About Open Merchant",
              message: `Open Merchant ${app.getVersion()}`,
              detail:
                "A local-first, AI-native workbench for deciding whether a product " +
                "opportunity is worth pursuing. Your project folders stay on your machine.",
            });
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  // Tests point this at a temp directory so they never touch real app data.
  const customUserData = process.env.OPEN_MERCHANT_USER_DATA;
  if (customUserData) app.setPath("userData", customUserData);

  const aiConfig = new AiConfigStore(app.getPath("userData"), safeStorage);
  registerIpcHandlers(new MerchantService(app.getVersion(), aiConfig), aiConfig);
  buildApplicationMenu();
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
 * Push a validated update-status event to every open window on the one-way
 * "update:status" channel. The payload is parsed with the shared schema on
 * this side too, so the renderer receives only contract-shaped data.
 */
function sendUpdateStatus(state: "available" | "not-available" | "downloaded", version?: string) {
  const payload = updateStatusSchema.parse(version ? { state, version } : { state });
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("update:status", payload);
  }
}

/**
 * Passive update check against our own GitHub Releases feed. Nothing is
 * sent anywhere; offline or failed checks are silent and safe. Skipped in
 * development and in tests so it only ever runs inside a packaged build.
 * When a new version is ready, the renderer shows a non-blocking banner
 * (Restart now / keep working); either way the update installs on quit.
 */
function initAutoUpdate() {
  if (!app.isPackaged || process.env.OPEN_MERCHANT_USER_DATA) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Testing override: point the updater at any HTTP folder (e.g. a local
  // `release/` directory served with any static server) by launching the
  // installed app with OPEN_MERCHANT_TEST_UPDATE_URL set. Nothing about the
  // normal GitHub flow changes when the variable is absent.
  const testFeedUrl = process.env.OPEN_MERCHANT_TEST_UPDATE_URL;
  if (testFeedUrl) {
    autoUpdater.setFeedURL({ provider: "generic", url: testFeedUrl });
  }

  autoUpdater.on("update-available", (info) => {
    sendUpdateStatus("available", info.version);
  });
  autoUpdater.on("update-downloaded", (info) => {
    sendUpdateStatus("downloaded", info.version);
  });

  autoUpdater.checkForUpdates().catch(() => {
    // Offline, rate-limited, or no release yet: stay quiet.
  });
}
