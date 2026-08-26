import type { IpcEnvelope } from "@open-merchant/shared";

declare global {
  interface Window {
    /** Present only inside the Electron shell; absent in plain-browser dev. */
    openMerchant?: {
      invoke(channel: string, payload: unknown): Promise<IpcEnvelope>;
    };
  }
}

export {};
