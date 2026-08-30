import { contextBridge, ipcRenderer } from "electron";

import { ipc } from "@open-merchant/shared";

/**
 * The renderer's only access to the desktop shell. Exactly one method is
 * exposed, and only the channels named in the shared contract are allowed
 * through — everything else is rejected before it reaches the OS.
 */

const allowedChannels = new Set(Object.keys(ipc));

contextBridge.exposeInMainWorld("openMerchant", {
  invoke: async (channel: string, payload: unknown) => {
    if (!allowedChannels.has(channel)) {
      return { ok: false as const, error: { code: "not-found", message: `Unknown channel: ${channel}` } };
    }
    return ipcRenderer.invoke("ipc", channel, payload);
  },
  /**
   * One-way subscription to main-process push events. Only the single
   * "update:status" channel is allowed through; returns an unsubscribe.
   */
  onUpdateStatus: (callback: (payload: unknown) => void): (() => void) => {
    const listener = (_event: unknown, payload: unknown): void => callback(payload);
    ipcRenderer.on("update:status", listener);
    return () => {
      ipcRenderer.removeListener("update:status", listener);
    };
  },
});
