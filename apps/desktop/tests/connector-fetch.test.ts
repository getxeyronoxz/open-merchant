import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceStore } from "@open-merchant/core";
import { AppError, type DraftRecord } from "@open-merchant/shared";

import type { McpToolClient } from "../src/main/connector-client";
import { PluginStore } from "../src/main/plugin-store";
import { MerchantService } from "../src/main/service";
import { writeConnectorPlugin } from "./fixtures/connector-plugin";

/**
 * The draft gate for connectors. A connector is a third-party program running
 * on the machine; the only thing it may ever do is hand back drafts for a
 * human to accept. These tests hold that line from both sides: a good fetch
 * changes nothing but the Draft Desk, and a bad one changes nothing at all.
 */

const NOW = "2026-09-25T12:00:00.000Z";

const evidence = {
  id: "S-001",
  url: "https://example.com/market",
  title: "Sample source",
  notes: "Connector result",
  observations: [],
  observedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

const competitors = [
  { product: "Keyboard", brand: "Keeb", price: "549.25", marketplace: "Example Bazaar", url: "https://example.com" },
];

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "om-connector-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A connector process that answers with the given structured content. */
function fakeClient(structuredContent: unknown, tools = [{ name: "fetch_market" }]): McpToolClient {
  return {
    connect: vi.fn(async () => undefined),
    listTools: vi.fn(async () => ({ tools })),
    callTool: vi.fn(async () => ({ structuredContent })),
    close: vi.fn(async () => undefined),
  };
}

/** A connector process that fails at startup, the way a broken one does. */
function brokenClient(): McpToolClient {
  return {
    connect: vi.fn(async () => {
      throw new Error("ENOENT: server.js not found");
    }),
    listTools: vi.fn(async () => ({ tools: [] })),
    callTool: vi.fn(async () => ({})),
    close: vi.fn(async () => undefined),
  };
}

function only<T>(items: T[]): T {
  expect(items).toHaveLength(1);
  return items[0] as T;
}

interface Fixture {
  service: MerchantService;
  root: string;
}

/** A real project on disk with an enabled connector installed in app data. */
async function setup(options: { enabled?: boolean } = {}): Promise<Fixture> {
  const parent = await tempDir();
  const userData = await tempDir();
  const service = new MerchantService("9.9.9-test", undefined, new PluginStore(userData));
  const created = await service.createProject({
    parentDirectory: parent,
    name: "Keyboards",
    objective: "Decide whether to enter the enthusiast keyboard market.",
    currency: "INR",
  });
  await writeConnectorPlugin(userData, { enabled: options.enabled ?? true });
  return { service, root: created.root };
}

describe("MerchantService.fetchFromConnector", () => {
  it("produces evidence and competitor drafts from an enabled connector", async () => {
    const { service, root } = await setup();
    const client = fakeClient({ evidence: [evidence], competitors });

    const result = await service.fetchFromConnector(root, "sample-market", "keyboard", () => client);

    expect(result.drafts.map((draft) => draft.kind)).toEqual(["evidence", "competitors"]);
    expect(client.callTool).toHaveBeenCalledWith({
      name: "fetch_market",
      arguments: { query: "keyboard" },
    });
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  });

  it("stamps every draft origin with the connector id and a 64-char response hash", async () => {
    const { service, root } = await setup();
    const client = fakeClient({ evidence: [evidence], competitors });

    const result = await service.fetchFromConnector(root, "sample-market", "keyboard", () => client);

    for (const draft of result.drafts) {
      expect(draft.origin).toMatchObject({ kind: "connector", connectorId: "sample-market" });
      if (draft.origin.kind !== "connector") throw new Error("expected a connector origin");
      expect(draft.origin.rawResponseHash).toMatch(/^[0-9a-f]{64}$/u);
      expect(draft.origin.fetchedAt).toBe(result.fetchedAt);
    }
  });

  it("writes no evidence, no competitors, and no provenance into the project", async () => {
    const { service, root } = await setup();
    const client = fakeClient({ evidence: [evidence], competitors });

    await service.fetchFromConnector(root, "sample-market", "keyboard", () => client);

    const store = await WorkspaceStore.open(root);
    expect(await store.loadEvidence()).toEqual([]);
    expect(await store.loadCompetitors()).toEqual([]);
    expect(await store.journal.listProvenance()).toEqual([]);
  });

  it("journals exactly one succeeded connectorFetched run in that project", async () => {
    const { service, root } = await setup();
    const client = fakeClient({ evidence: [evidence], competitors });

    await service.fetchFromConnector(root, "sample-market", "keyboard", () => client);

    const runs = await service.listRuns(root);
    expect(runs.map((run) => run.operation)).toEqual(["projectCreated", "connectorFetched"]);
    const fetched = only(runs.filter((run) => run.operation === "connectorFetched"));
    expect(fetched.status).toBe("succeeded");
    expect(fetched.appVersion).toBe("9.9.9-test");
    // Nothing was produced on disk, so a run may not claim an output artifact.
    expect(fetched.outputArtifacts).toEqual([]);
  });

  it("refuses a disabled connector with a coded error and never runs it", async () => {
    const { service, root } = await setup({ enabled: false });
    const client = fakeClient({ evidence: [evidence], competitors });

    const failure = service.fetchFromConnector(root, "sample-market", "keyboard", () => client);

    await expect(failure).rejects.toBeInstanceOf(AppError);
    await expect(failure).rejects.toMatchObject({ code: "not-found" });
    expect(client.callTool).not.toHaveBeenCalled();
  });

  it("refuses a plugin that is not a connector", async () => {
    const { service, root } = await setup();
    const client = fakeClient({ evidence: [evidence], competitors });

    const failure = service.fetchFromConnector(root, "not-installed", "keyboard", () => client);

    await expect(failure).rejects.toMatchObject({ code: "not-found" });
    expect(client.callTool).not.toHaveBeenCalled();
  });

  it("refuses a connector that returns neither evidence nor competitors", async () => {
    const { service, root } = await setup();
    const client = fakeClient({ evidence: [], competitors: [] });

    await expect(
      service.fetchFromConnector(root, "sample-market", "keyboard", () => client),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("leaves the project untouched when the connector throws", async () => {
    const { service, root } = await setup();
    const client = brokenClient();

    await expect(
      service.fetchFromConnector(root, "sample-market", "keyboard", () => client),
    ).rejects.toBeInstanceOf(AppError);

    // Not one byte: a third-party process that fails must not leave a trace.
    const runs = await service.listRuns(root);
    expect(runs.map((run) => run.operation)).toEqual(["projectCreated"]);
    const store = await WorkspaceStore.open(root);
    expect(await store.loadEvidence()).toEqual([]);
    expect(await store.loadCompetitors()).toEqual([]);
  });

  it("gives two fetches in the same millisecond distinct draft ids", async () => {
    const { service, root } = await setup();
    const client = fakeClient({ evidence: [evidence], competitors });

    const first = await service.fetchFromConnector(root, "sample-market", "keyboard", () => client);
    const second = await service.fetchFromConnector(root, "sample-market", "keyboard", () => client);

    const ids = new Set([...first.drafts, ...second.drafts].map((draft: DraftRecord) => draft.id));
    expect(ids.size).toBe(4);
  });
});
