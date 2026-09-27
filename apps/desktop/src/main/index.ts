import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, Menu, app, dialog, safeStorage, shell } from "electron";
import { autoUpdater } from "electron-updater";

import { updateStatusSchema, type UpdateStatus } from "@open-merchant/shared";

import { describeUpdate } from "./update-notice";

import { AiConfigStore } from "./ai-config";
import { PluginStore } from "./plugin-store";
import { MerchantService } from "./service";
import { registerIpcHandlers } from "./ipc";

/**
 * This package is `"type": "module"`, so electron-vite emits the main process
 * as ESM and CommonJS globals like `__dirname` do not exist. Deriving it from
 * the module URL is the supported equivalent; using `__dirname` here throws
 * before the window is ever created.
 */
const mainDirectory = dirname(fileURLToPath(import.meta.url));

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: "Open Merchant",
    backgroundColor: "#0d0f0e",
    // Integrated, VS Code-style title bar on Windows: the renderer top edge
    // doubles as the drag region and the system controls adopt the Ledger
    // palette. Linux keeps its native frame + our custom menu (overlay
    // controls are unreliable across Linux window managers).
    ...(process.platform === "win32"
      ? {
          titleBarStyle: "hidden" as const,
          titleBarOverlay: {
            color: "#0d0f0e",
            symbolColor: "#e8e4d8",
            height: 40,
          },
        }
      : {}),
    // Packaged builds get the icon embedded in the executable; development
    // points at the source asset so the taskbar shows the mark too.
    ...(app.isPackaged
      ? {}
      : { icon: join(app.getAppPath(), "build", "icon.png") }),
    webPreferences: {
      preload: join(mainDirectory, "../preload/index.js"),
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
    void win.loadFile(join(mainDirectory, "../renderer/index.html"));
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
            // Answers the person who clicked it. Previously this fired a check
            // and said nothing either way, so "you are on the newest release"
            // and "the feed was unreachable" were the same silence — and only
            // one of those is good news.
            void dialog.showMessageBox({
              type: "info",
              title: "Updates",
              message: "Checking for updates…",
            });
            void checkForUpdates().then((status) => {
              const notice = describeUpdate(status, app.getVersion());
              void dialog.showMessageBox({
                type: notice.isProblem ? "warning" : "info",
                title: "Updates",
                message: notice.message,
              });
            });
          },
        },
        { type: "separator" },
        {
          label: "Open Merchant on GitHub",
          click: () => {
            void shell.openExternal("https://github.com/getxeyronoxz/open-merchant");
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
  const plugins = new PluginStore(app.getPath("userData"), app.getVersion());
  registerIpcHandlers(
    new MerchantService(app.getVersion(), aiConfig, plugins),
    aiConfig,
    plugins,
    checkForUpdates,
  );
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
function sendUpdateStatus(
  state: "checking" | "available" | "not-available" | "downloaded" | "error",
  version?: string,
  detail?: string,
) {
  const payload = updateStatusSchema.parse({
    state,
    ...(version === undefined ? {} : { version }),
    ...(detail === undefined ? {} : { detail }),
  });
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
  autoUpdater.on("update-not-available", () => {
    sendUpdateStatus("not-available");
  });
  autoUpdater.on("update-downloaded", (info) => {
    sendUpdateStatus("downloaded", info.version);
  });
  // Without this the failure is invisible: the promise rejects into a comment
  // and electron-updater's own logger writes to a stdout nobody reads in a
  // packaged build. A seller then cannot tell that they are missing fixes.
  autoUpdater.on("error", (error: Error) => {
    sendUpdateStatus("error", undefined, error.message);
  });

  // A single check at launch is not enough. Launching offline is ordinary —
  // this is a local-first app — and one failed check at startup used to leave a
  // user on a stale build with no further attempt and no way to know.
  void checkForUpdates();
  const timer = setInterval(() => void checkForUpdates(), UPDATE_CHECK_INTERVAL_MS);
  timer.unref();
}

/** Six hours: often enough to notice a release in a session, rarely enough to be quiet. */
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** How long a completed check is good for before a caller asking again re-checks. */
const UPDATE_STATUS_FRESH_MS = 60 * 1000;

let lastCheck: { at: number; status: UpdateStatus } | null = null;
let inFlight: Promise<UpdateStatus> | null = null;

/**
 * One update check, reported honestly whichever way it goes.
 *
 * The menu, the timer, and the window on mount all ask through here, so a
 * fresh result is shared rather than each one hitting the network. Returns the
 * state so a caller that asked can answer immediately, and pushes the same
 * state to any open window: "up to date", "could not ask", and "a newer
 * version is downloading" are three different facts.
 */
async function checkForUpdates(options: { force?: boolean } = {}): Promise<UpdateStatus> {
  // Guarded here, not only in initAutoUpdate. The renderer and the menu both
  // call this directly, and without the guard a development checkout reached
  // the network with no feed — and app.getVersion() there reports Electron's
  // version, so the strip announced "you are on 39.8.10, the newest release"
  // about software that is not Open Merchant.
  if (!app.isPackaged) {
    return { state: "unavailable", detail: "This is a development build; it has no update feed." };
  }

  const fresh = lastCheck !== null && Date.now() - lastCheck.at < UPDATE_STATUS_FRESH_MS;
  if (!options.force && fresh && lastCheck !== null) return lastCheck.status;
  // A second caller arriving while the first is still running joins it rather
  // than starting a competing check.
  if (inFlight !== null) return inFlight;

  sendUpdateStatus("checking");
  inFlight = (async (): Promise<UpdateStatus> => {
    try {
      const result = await autoUpdater.checkForUpdates();
      // A resolved check with no updateInfo is "nothing newer"; the
      // update-not-available event is what usually reports it, and this covers
      // the case where it has already fired before we got here.
      const version = result?.updateInfo?.version;
      const status: UpdateStatus =
        version === undefined ? { state: "not-available" } : { state: "available", version };
      if (version !== undefined) sendUpdateStatus("available", version);
      lastCheck = { at: Date.now(), status };
      return status;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      sendUpdateStatus("error", undefined, detail);
      lastCheck = { at: Date.now(), status: { state: "error", detail } };
      return lastCheck.status;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
