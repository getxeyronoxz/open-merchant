import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createProjectFolder } from "@open-merchant/core";
import {
  AppError,
  ipc,
  manifestSchema,
  type IpcChannel,
  type IpcRequest,
  type IpcResponse,
} from "@open-merchant/shared";
import { app, ipcMain } from "electron";

import { RecentsStore } from "./recents";

/**
 * The single IPC entry point. Each channel's request is validated against
 * the shared contract before its handler runs, and every outcome — success
 * or coded failure — travels back as an envelope the SDK understands.
 */

type Handler<C extends IpcChannel> = (request: IpcRequest<C>) => Promise<IpcResponse<C>>;

const MANIFEST_RELATIVE = join(".openmerchant", "manifest.json");

export function registerIpcHandlers(): void {
  const recents = new RecentsStore(app.getPath("userData"));

  const handlers: { [C in IpcChannel]: Handler<C> } = {
    "app/info": async () => ({
      appName: "Open Merchant",
      appVersion: app.getVersion(),
      platform: process.platform,
    }),
    "project/create": async (input) => {
      const created = await createProjectFolder(input);
      await recents.upsert(created.manifest.name, created.root);
      return { snapshot: { root: created.root, manifest: created.manifest } };
    },
    "project/open": async ({ root }) => {
      let raw: string;
      try {
        raw = await readFile(join(root, MANIFEST_RELATIVE), "utf8");
      } catch {
        throw new AppError({
          code: "not-a-project",
          message: "That folder is not an Open Merchant project.",
          detail: `Missing or unreadable ${MANIFEST_RELATIVE} in ${root}`,
        });
      }
      let manifest;
      try {
        manifest = manifestSchema.parse(JSON.parse(raw));
      } catch (error) {
        throw new AppError({
          code: "invalid-project",
          message: "This project's manifest is malformed and was left unchanged.",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
      await recents.upsert(manifest.name, root);
      return { snapshot: { root, manifest } };
    },
    "recents/list": async () => ({ projects: await recents.list() }),
  };

  ipcMain.handle("ipc", async (_event, channel: string, payload: unknown) => {
    if (!Object.hasOwn(handlers, channel)) {
      return {
        ok: false as const,
        error: { code: "not-found", message: `Unknown channel: ${channel}` },
      };
    }
    try {
      const key = channel as IpcChannel;
      const request = ipc[key].request.parse(payload ?? {}) as IpcRequest<IpcChannel>;
      // Each handler above is declared against its own exact request type;
      // the contract parse immediately before this call is what guarantees
      // the payload matches, so the erasure here is sound.
      const handler = handlers[key] as (request: unknown) => Promise<unknown>;
      const value = await handler(request);
      return { ok: true as const, value };
    } catch (error) {
      if (error instanceof AppError) {
        return { ok: false as const, error: error.toJSON() };
      }
      const message = error instanceof Error ? error.message : String(error);
      const code = /already exists/i.test(message)
        ? ("already-exists" as const)
        : /required|invalid/i.test(message)
          ? ("invalid-input" as const)
          : ("storage-error" as const);
      return {
        ok: false as const,
        error: {
          code,
          message,
          detail: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  });
}
