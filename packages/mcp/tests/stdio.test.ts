import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ArtifactPaths } from "@open-merchant/core";
import { DEFAULT_NEGOTIATED_PROTOCOL_VERSION } from "@modelcontextprotocol/server";

import { cleanupFixture, createFixture, type Fixture } from "./fixture.js";

interface JsonRpcResponse {
  readonly id: number;
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly code: number; readonly message: string };
}

const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

class StdioClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly lines: ReturnType<typeof createInterface>;
  private readonly pending = new Map<number, (response: JsonRpcResponse) => void>();
  private nextId = 0;
  stderr = "";
  capabilities: Record<string, unknown> = {};

  constructor(projectRoot: string) {
    this.child = spawn(process.execPath, [CLI, projectRoot], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.lines = createInterface({ input: this.child.stdout });
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      this.stderr += chunk;
    });
    this.lines.on("line", (line) => {
      const message = JSON.parse(line) as JsonRpcResponse;
      this.pending.get(message.id)?.(message);
      this.pending.delete(message.id);
    });
  }

  async request(method: string, params: Record<string, unknown> = {}): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    const response = new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}. stderr: ${this.stderr}`));
      }, 10_000);
      this.pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return response;
  }

  notify(method: string, params: Record<string, unknown> = {}): void {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  async initialize(): Promise<void> {
    const response = await this.request("initialize", {
      protocolVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "spawned-vitest-host", version: "1.0.0" },
    });
    expect(response.error).toBeUndefined();
    this.capabilities = (response.result?.capabilities ?? {}) as Record<string, unknown>;
    this.notify("notifications/initialized");
  }

  async close(): Promise<void> {
    this.lines.close();
    this.child.stdin.end();
    this.child.kill();
  }
}

async function mcpReadCount(root: string): Promise<number> {
  const raw = await readFile(join(root, ArtifactPaths.runs), "utf8").catch(() => "");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { operation?: string })
    .filter((entry) => entry.operation === "mcpArtifactRead").length;
}

describe("spawned open-merchant-mcp executable", () => {
  let fixture: Fixture | undefined;
  let client: StdioClient | undefined;

  afterEach(async () => {
    await client?.close();
    if (fixture) await cleanupFixture(fixture);
    client = undefined;
    fixture = undefined;
  });

  it("speaks MCP over real stdio, reads every resource, and refuses writes", async () => {
    fixture = await createFixture();
    const before = await mcpReadCount(fixture.root);
    client = new StdioClient(fixture.root);
    await client.initialize();

    const list = await client.request("resources/list");
    expect(list.error).toBeUndefined();
    const resources = (list.result?.resources as { uri: string }[] | undefined) ?? [];
    expect(resources.map((entry) => entry.uri)).toEqual([
      "openmerchant://manifest",
      "openmerchant://evidence",
      "openmerchant://competitors",
      "openmerchant://snapshots",
      "openmerchant://economics/assumptions",
      "openmerchant://economics/scenarios",
      "openmerchant://reports/sections",
      "openmerchant://reports/opportunity",
      "openmerchant://journal/runs",
      "openmerchant://journal/provenance",
      `openmerchant://snapshots/${fixture.snapshotId}`,
    ]);

    for (const resource of resources) {
      const read = await client.request("resources/read", { uri: resource.uri });
      expect(read.error, `${resource.uri}: ${client.stderr}`).toBeUndefined();
      const contents = read.result?.contents as { text?: string }[] | undefined;
      expect(contents, resource.uri).toHaveLength(1);
      expect(typeof contents?.[0]?.text, resource.uri).toBe("string");
      if (resource.uri !== "openmerchant://journal/provenance") {
        expect(contents?.[0]?.text?.length, resource.uri).toBeGreaterThan(0);
      }
    }
    expect(await mcpReadCount(fixture.root)).toBe(before + resources.length);

    expect(client.capabilities).toHaveProperty("resources");
    expect(client.capabilities).not.toHaveProperty("tools");
    const tools = await client.request("tools/list");
    expect(tools.result).toBeUndefined();
    expect(tools.error?.message).toMatch(/tool|method|not found/iu);
    const write = await client.request("tools/call", {
      name: "save-evidence",
      arguments: { hostile: true },
    });
    expect(write.result).toBeUndefined();
    expect(write.error?.message).toMatch(/tool|not found/iu);
  });
});
