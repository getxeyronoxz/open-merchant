import { createHash } from "node:crypto";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { connectorResultSchema, type ConnectorResult, type PluginManifest } from "@open-merchant/shared";

const MAX_TOOL_RESPONSE_BYTES = 2 * 1024 * 1024;
const CONNECTOR_TIMEOUT_MS = 30_000;

export class ConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectorError";
  }
}

export interface ConnectorFetchResult {
  readonly result: ConnectorResult;
  readonly rawResponse: string;
  readonly rawResponseHash: string;
}

/** The narrow client surface the runner needs; exported for unit tests. */
export interface McpToolClient {
  connect(transport: StdioClientTransport): Promise<void>;
  listTools(): Promise<{ tools: { name: string }[] }>;
  callTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<unknown>;
  close(): Promise<void>;
}

export type ConnectorClientFactory = () => McpToolClient;

function withTimeout<T>(work: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new ConnectorError(`${label} timed out after 30 seconds.`)),
      CONNECTOR_TIMEOUT_MS,
    );
    timer.unref();
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** Executes one explicit tool call against one enabled local connector. */
export async function fetchFromConnector(
  manifest: Extract<PluginManifest, { kind: "connector" }>,
  directory: string,
  input: Record<string, unknown>,
  createClient: ConnectorClientFactory = () => new Client({ name: "open-merchant", version: "1.0.0-alpha.4" }),
): Promise<ConnectorFetchResult> {
  if (!manifest.capabilities.writes.includes("drafts")) {
    throw new ConnectorError(`Connector ${manifest.id} does not declare permission to produce drafts.`);
  }

  const client = createClient();
  const transport = new StdioClientTransport({
    command: manifest.command,
    args: manifest.args,
    cwd: directory,
    env: {
      PATH: process.env.PATH ?? "",
      SystemRoot: process.env.SystemRoot ?? "",
      WINDIR: process.env.WINDIR ?? "",
      TEMP: process.env.TEMP ?? "",
      TMP: process.env.TMP ?? "",
    },
    stderr: "pipe",
    maxBufferSize: MAX_TOOL_RESPONSE_BYTES,
  });

  try {
    await withTimeout(client.connect(transport), "Connector startup");
    const listed = await withTimeout(client.listTools(), "Connector tool discovery");
    const matches = listed.tools.filter((tool) => tool.name === manifest.toolName);
    if (matches.length !== 1) {
      throw new ConnectorError(
        `Connector ${manifest.id} must expose exactly one tool named ${manifest.toolName}; found ${matches.length}.`,
      );
    }
    const response = await withTimeout(
      client.callTool({ name: manifest.toolName, arguments: input }),
      "Connector fetch",
    );
    if (response === null || typeof response !== "object") {
      throw new ConnectorError("Connector returned an invalid tool response.");
    }
    const candidate = response as { structuredContent?: unknown; isError?: boolean };
    if (candidate.isError === true) throw new ConnectorError("Connector reported that the fetch failed.");
    if (candidate.structuredContent === undefined) {
      throw new ConnectorError("Connector must return structuredContent matching the connector schema.");
    }
    const result = connectorResultSchema.parse(candidate.structuredContent);
    if (result.evidence.length === 0 && result.competitors.length === 0) {
      throw new ConnectorError("Connector returned no evidence or competitor drafts.");
    }
    const rawResponse = JSON.stringify(candidate.structuredContent);
    return {
      result,
      rawResponse,
      rawResponseHash: createHash("sha256").update(rawResponse, "utf8").digest("hex"),
    };
  } catch (error) {
    if (error instanceof ConnectorError) throw error;
    throw new ConnectorError(
      `Connector ${manifest.id} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}
