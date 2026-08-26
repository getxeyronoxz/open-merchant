import { createDesktopClient, createMockDesktopClient, type DesktopClient } from "@open-merchant/sdk";

/**
 * Inside Electron the client talks over IPC; in a plain browser dev server
 * it falls back to an in-memory mock so UI work never needs the shell.
 */
export const client: DesktopClient = window.openMerchant
  ? createDesktopClient((channel, payload) => window.openMerchant!.invoke(channel, payload))
  : (createMockDesktopClient() as unknown as DesktopClient);
