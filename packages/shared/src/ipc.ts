import { z } from "zod";

import { isoDateTimeSchema } from "./artifacts";
import { manifestSchema } from "./artifacts";

/**
 * The IPC contract between renderer and main process. This map is the single
 * source of truth: the SDK types itself against it, the preload bridge
 * allows exactly these channels, and main-process handlers validate payloads
 * with the same schemas. Adding a capability means adding an entry here.
 */

export const recentProjectSchema = z.object({
  name: z.string(),
  path: z.string(),
  lastOpenedAt: isoDateTimeSchema,
});

export type RecentProject = z.infer<typeof recentProjectSchema>;

export const createProjectInputSchema = z.object({
  parentDirectory: z.string(),
  name: z.string(),
  objective: z.string(),
  currency: z.string(),
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export const openProjectInputSchema = z.object({ root: z.string() });
export const rootOnlyInputSchema = z.object({ root: z.string() });

/**
 * Walking-skeleton contract (phase 0): application identity plus the two
 * project primitives needed by a stub Home screen. Later phases extend this
 * map — evidence, competitors, economics, report, artifacts, AI.
 */
export const ipc = {
  "app/info": {
    request: z.object({}),
    response: z.object({
      appName: z.string(),
      appVersion: z.string(),
      platform: z.string(),
    }),
  },
  "project/create": {
    request: createProjectInputSchema,
    response: z.object({
      snapshot: z.object({ root: z.string(), manifest: manifestSchema }),
    }),
  },
  "project/open": {
    request: openProjectInputSchema,
    response: z.object({
      snapshot: z.object({ root: z.string(), manifest: manifestSchema }),
    }),
  },
  "recents/list": {
    request: rootOnlyInputSchema.partial(),
    response: z.object({ projects: z.array(recentProjectSchema) }),
  },
} as const;

export type IpcContract = typeof ipc;
export type IpcChannel = keyof IpcContract & string;

export type IpcRequest<C extends IpcChannel> = z.infer<IpcContract[C]["request"]>;
export type IpcResponse<C extends IpcChannel> = z.infer<IpcContract[C]["response"]>;

/** Wire format for any rejected command. Successes carry the raw response. */
export const ipcEnvelopeSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), value: z.unknown() }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string(), detail: z.string().optional() }) }),
]);

export type IpcEnvelope = z.infer<typeof ipcEnvelopeSchema>;
