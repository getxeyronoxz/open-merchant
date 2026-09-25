import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { PluginManifest } from "@open-merchant/shared";

import { fetchFromConnector, type McpToolClient } from "../src/main/connector-client";
import { PluginStore } from "../src/main/plugin-store";
import { writeConnectorPlugin } from "./fixtures/connector-plugin";

const NOW = "2026-09-25T12:00:00.000Z";

const manifest: Extract<PluginManifest, { kind: "connector" }> = {
  id: "sample-market",
  kind: "connector",
  name: "Sample market",
  version: "1.0.0",
  author: "Open Merchant",
  minAppVersion: "1.0.0-alpha.4",
  description: "Returns one deterministic market record.",
  toolName: "fetch_market",
  command: "node",
  args: ["server.mjs"],
  capabilities: { reads: ["project", "market"], writes: ["drafts"], network: false },
};

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

function fakeClient(response: unknown, tools = [{ name: "fetch_market" }]): {
  client: McpToolClient;
  close: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn(async () => undefined);
  return {
    close,
    client: {
      connect: vi.fn(async () => undefined),
      listTools: vi.fn(async () => ({ tools })),
      callTool: vi.fn(async () => response),
      close,
    },
  };
}

describe("fetchFromConnector", () => {
  it("calls one declared tool and returns validated drafts with a raw hash", async () => {
    const { client, close } = fakeClient({ structuredContent: { evidence: [evidence], competitors: [] } });
    const result = await fetchFromConnector(manifest, "C:/plugins/sample", { query: "keyboard" }, () => client);

    expect(result.result.evidence).toEqual([evidence]);
    expect(result.rawResponseHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(client.callTool).toHaveBeenCalledWith({
      name: "fetch_market",
      arguments: { query: "keyboard" },
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("refuses undeclared draft writes, missing tools, errors, and empty results", async () => {
    await expect(
      fetchFromConnector(
        { ...manifest, capabilities: { ...manifest.capabilities, writes: [] } },
        "C:/plugins/sample",
        {},
        () => fakeClient({ structuredContent: { evidence: [evidence] } }).client,
      ),
    ).rejects.toThrow(/does not declare/iu);

    await expect(
      fetchFromConnector(manifest, "C:/plugins/sample", {}, () => fakeClient({ structuredContent: {} }, []).client),
    ).rejects.toThrow(/exactly one tool/iu);

    await expect(
      fetchFromConnector(manifest, "C:/plugins/sample", {}, () => fakeClient({ isError: true }).client),
    ).rejects.toThrow(/reported/iu);

    await expect(
      fetchFromConnector(
        manifest,
        "C:/plugins/sample",
        {},
        () => fakeClient({ structuredContent: { evidence: [], competitors: [] } }).client,
      ),
    ).rejects.toThrow(/no evidence/iu);
  });

  it("closes the client when validation fails", async () => {
    const { client, close } = fakeClient({ structuredContent: { evidence: [{ id: "bad" }] } });
    await expect(fetchFromConnector(manifest, "C:/plugins/sample", {}, () => client)).rejects.toThrow();
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("the fixture connector manifest", () => {
  it("is discovered as a valid, non-broken plugin", async () => {
    const dir = await mkdtemp(join(tmpdir(), "om-connector-"));
    try {
      const id = await writeConnectorPlugin(dir);

      const catalog = await new PluginStore(dir).list();

      expect(catalog.broken).toEqual([]);
      expect(catalog.plugins).toHaveLength(1);
      expect(catalog.plugins[0]?.manifest.id).toBe(id);
      expect(catalog.plugins[0]?.manifest.kind).toBe("connector");
      expect(catalog.plugins[0]?.enabled).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("can be written already enabled", async () => {
    const dir = await mkdtemp(join(tmpdir(), "om-connector-"));
    try {
      await writeConnectorPlugin(dir, { enabled: true });

      const catalog = await new PluginStore(dir).list();

      expect(catalog.plugins[0]?.enabled).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
