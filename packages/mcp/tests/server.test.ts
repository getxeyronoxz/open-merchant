import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  type McpServer,
  type Transport,
} from "@modelcontextprotocol/server";

import { ArtifactPaths } from "@open-merchant/core";

import { ReadOnlyProject } from "../src/project.js";
import { createMcpServer } from "../src/server.js";
import { cleanupFixture, createFixture, type Fixture } from "./fixture.js";

interface JsonRpcResponse {
  readonly id: number;
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly code: number; readonly message: string };
}

type IncomingMessage = Parameters<NonNullable<Transport["onmessage"]>>[0];

interface Pipe {
  readonly server: McpServer;
  readonly transport: Transport;
  readonly sent: unknown[];
  deliver(message: IncomingMessage): void;
}

function openPipe(mcp: McpServer): Pipe {
  const sent: unknown[] = [];
  const transport: Transport = {
    onmessage: undefined,
    onclose: undefined,
    onerror: undefined,
    start: async () => undefined,
    send: async (message) => {
      sent.push(message);
    },
    close: async () => undefined,
  };
  return {
    server: mcp,
    transport,
    sent,
    deliver: (message) => {
      if (!transport.onmessage) throw new Error("transport not connected");
      transport.onmessage(message);
    },
  };
}

async function waitForResponse(pipe: Pipe, id: number): Promise<JsonRpcResponse> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const match = pipe.sent.find(
      (message): message is JsonRpcResponse =>
        typeof message === "object" &&
        message !== null &&
        "id" in message &&
        (message as { id?: unknown }).id === id,
    );
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`No response for id ${id}: ${JSON.stringify(pipe.sent)}`);
}

async function countMcpReads(root: string): Promise<number> {
  const raw = await readFile(join(root, ArtifactPaths.runs), "utf8").catch(() => "");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { operation?: string })
    .filter((entry) => entry.operation === "mcpArtifactRead").length;
}

describe("MCP server protocol surface", () => {
  let fixture: Fixture;
  let pipe: Pipe;
  let capabilities: Record<string, unknown>;

  beforeAll(async () => {
    fixture = await createFixture();
    pipe = openPipe(createMcpServer(await ReadOnlyProject.open(fixture.root)));
    await pipe.server.connect(pipe.transport);
    pipe.deliver({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "vitest-host", version: "0.0.0" },
      },
    });
    const init = await waitForResponse(pipe, 0);
    expect(init.result).toBeDefined();
    capabilities = (init.result?.capabilities ?? {}) as Record<string, unknown>;
    pipe.deliver({ jsonrpc: "2.0", method: "notifications/initialized" });
  });

  afterAll(async () => {
    await pipe.server.close();
    await cleanupFixture(fixture);
  });

  it("advertises resources but no tools capability", async () => {
    expect(capabilities).toHaveProperty("resources");
    expect(capabilities).not.toHaveProperty("tools");
    pipe.deliver({ jsonrpc: "2.0", id: 1, method: "resources/list", params: {} });
    const list = await waitForResponse(pipe, 1);
    const resources = list.result?.resources as { uri: string }[] | undefined;
    expect(resources?.map((entry) => entry.uri)).toContain("openmerchant://manifest");
    expect(resources?.some((entry) => entry.uri.startsWith("openmerchant://snapshots/SNAP-"))).toBe(true);
  });

  it("reads a resource over the wire and journals it", async () => {
    const before = await countMcpReads(fixture.root);
    pipe.deliver({
      jsonrpc: "2.0",
      id: 2,
      method: "resources/read",
      params: { uri: "openmerchant://manifest" },
    });
    const read = await waitForResponse(pipe, 2);
    const contents = read.result?.contents as { text?: string }[] | undefined;
    expect(contents?.[0]?.text).toContain("MCP Fixture");
    expect(await countMcpReads(fixture.root)).toBe(before + 1);
  });

  it("refuses an unknown resource read with a protocol error", async () => {
    pipe.deliver({
      jsonrpc: "2.0",
      id: 3,
      method: "resources/read",
      params: { uri: "openmerchant://nowhere" },
    });
    const read = await waitForResponse(pipe, 3);
    expect(read.error).toBeDefined();
    expect(read.error?.message).toMatch(/resource|not found|no such/iu);
  });

  it("refuses every tool (write) attempt loudly", async () => {
    pipe.deliver({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "save-evidence", arguments: { notes: "hostile write" } },
    });
    const call = await waitForResponse(pipe, 4);
    expect(call.error).toBeDefined();
    expect(call.result).toBeUndefined();
  });
});
