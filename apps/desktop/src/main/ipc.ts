import { type IpcChannel, type IpcRequest, type IpcResponse, AppError, ipc } from "@open-merchant/shared";
import { app, ipcMain } from "electron";

import { RecentsStore } from "./recents";
import type { MerchantService } from "./service";

/**
 * The single IPC entry point. Each channel's request is validated against
 * the shared contract before its handler runs, and every outcome — success
 * or coded failure — travels back as an envelope the SDK understands.
 */

type AnyHandler = (request: unknown) => Promise<unknown>;

/**
 * Captures the exact contract types for one channel while erasing them for
 * uniform dispatch; the contract parse immediately before invocation is what
 * makes this safe.
 */
function channel<C extends IpcChannel>(handle: (request: IpcRequest<C>) => Promise<IpcResponse<C>>): AnyHandler {
  return async (request) => handle(request as IpcRequest<C>);
}

export function registerIpcHandlers(service: MerchantService): void {
  const recents = new RecentsStore(app.getPath("userData"));

  const handlers: Record<IpcChannel, AnyHandler> = {
    "app/info": channel<"app/info">(async () => ({
      appName: "Open Merchant",
      appVersion: app.getVersion(),
      platform: process.platform,
    })),

    "project/create": channel<"project/create">(async (input) => {
      const created = await service.createProject(input);
      await recents.upsert(created.manifest.name, created.root);
      return { snapshot: { root: created.root, manifest: created.manifest } };
    }),
    "project/open": channel<"project/open">(async ({ root }) => {
      const store = await service.openStore(root);
      await recents.upsert(store.manifest.name, root);
      return { snapshot: { root, manifest: store.manifest } };
    }),
    "project/import-v0": channel<"project/import-v0">(async ({ v0Root, parentDirectory }) => {
      const result = await service.importV0(v0Root, parentDirectory);
      await recents.upsert(result.manifest.name, result.root);
      return {
        snapshot: { root: result.root, manifest: result.manifest },
        importedEvidence: result.importedEvidence,
        importedCompetitors: result.importedCompetitors,
      };
    }),

    "recents/list": channel<"recents/list">(async () => ({ projects: await recents.list() })),
    "recents/remove": channel<"recents/remove">(async ({ path }) => {
      await recents.remove(path);
      return {};
    }),

    "evidence/load": channel<"evidence/load">(async ({ root }) => ({
      sources: await service.loadEvidence(root),
    })),
    "evidence/save": channel<"evidence/save">(async ({ root, sources }) => {
      await service.saveEvidence(root, sources);
      return {};
    }),

    "competitors/load": channel<"competitors/load">(async ({ root }) => ({
      competitors: await service.loadCompetitors(root),
    })),
    "competitors/save": channel<"competitors/save">(async ({ root, competitors }) => {
      await service.saveCompetitors(root, competitors);
      return {};
    }),
    "competitors/statistics": channel<"competitors/statistics">(async ({ root }) => ({
      statistics: await service.competitorStatistics(root),
    })),

    "assumptions/load": channel<"assumptions/load">(async ({ root }) => ({
      assumptions: await service.loadAssumptions(root),
    })),
    "assumptions/save": channel<"assumptions/save">(async ({ root, assumptions }) => {
      await service.saveAssumptions(root, assumptions);
      return {};
    }),
    "economics/calculate": channel<"economics/calculate">(async ({ root }) => ({
      scenarios: await service.calculateScenarios(root),
    })),
    "scenarios/load": channel<"scenarios/load">(async ({ root }) => ({
      scenarios: await service.loadScenarios(root),
    })),

    "report/sections/load": channel<"report/sections/load">(async ({ root }) => ({
      sections: await service.loadReportSections(root),
    })),
    "report/sections/save": channel<"report/sections/save">(async ({ root, sections }) => {
      await service.saveReportSections(root, sections);
      return {};
    }),
    "report/generate": channel<"report/generate">(async ({ root }) => ({
      markdown: await service.generateReport(root),
    })),
    "report/load-generated": channel<"report/load-generated">(async ({ root }) => ({
      markdown: await service.loadGeneratedReport(root),
    })),

    "artifacts/list": channel<"artifacts/list">(async ({ root }) => ({
      artifacts: await service.listArtifacts(root),
    })),
    "artifacts/read": channel<"artifacts/read">(async ({ root, relativePath }) => ({
      text: await service.readArtifact(root, relativePath),
    })),
    "runs/list": channel<"runs/list">(async ({ root }) => ({ runs: await service.listRuns(root) })),
    "provenance/list": channel<"provenance/list">(async ({ root }) => ({
      provenance: await service.listProvenance(root),
    })),
  };

  ipcMain.handle("ipc", async (_event, channelName: string, payload: unknown) => {
    if (!Object.hasOwn(handlers, channelName)) {
      return {
        ok: false as const,
        error: { code: "not-found", message: `Unknown channel: ${channelName}` },
      };
    }
    try {
      const key = channelName as IpcChannel;
      const request = ipc[key].request.parse(payload ?? {});
      const value = await handlers[key](request);
      return { ok: true as const, value };
    } catch (error) {
      if (error instanceof AppError) {
        return { ok: false as const, error: error.toJSON() };
      }
      return {
        ok: false as const,
        error: {
          code: "storage-error",
          message: error instanceof Error ? error.message : String(error),
          detail: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  });
}
