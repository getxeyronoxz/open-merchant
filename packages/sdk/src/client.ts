import {
  AppError,
  appErrorSchema,
  ipc,
  ipcEnvelopeSchema,
  type IpcChannel,
  type IpcRequest,
  type IpcResponse,
} from "@open-merchant/shared";

/**
 * The only way the renderer talks to the desktop shell. The renderer never
 * imports Electron; it consumes this typed client. Responses are validated
 * against the shared contract before they reach the UI, and every failure is
 * surfaced as a coded {@link AppError} — errors are never swallowed.
 */

export type RawInvoke = (channel: string, request: unknown) => Promise<unknown>;

async function invoke<C extends IpcChannel>(raw: RawInvoke, channel: C, request: IpcRequest<C>): Promise<IpcResponse<C>> {
  const envelope = ipcEnvelopeSchema.parse(await raw(channel, request));
  if (!envelope.ok) {
    throw new AppError(appErrorSchema.parse(envelope.error));
  }
  return ipc[channel].response.parse(envelope.value) as IpcResponse<C>;
}

export interface DesktopClient {
  appInfo(): Promise<IpcResponse<"app/info">>;
  createProject(request: IpcRequest<"project/create">): Promise<IpcResponse<"project/create">>;
  openProject(request: IpcRequest<"project/open">): Promise<IpcResponse<"project/open">>;
  listRecents(): Promise<IpcResponse<"recents/list">>;
}

export function createDesktopClient(raw: RawInvoke): DesktopClient {
  return {
    appInfo: () => invoke(raw, "app/info", {}),
    createProject: (request) => invoke(raw, "project/create", request),
    openProject: (request) => invoke(raw, "project/open", request),
    listRecents: () => invoke(raw, "recents/list", {}),
  };
}
