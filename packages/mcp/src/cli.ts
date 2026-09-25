#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

import { ReadOnlyProject } from "./project.js";
import { createMcpServer } from "./server.js";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "./version.js";

const USAGE = `usage: open-merchant-mcp <project-folder>

Spawns the read-only Open Merchant MCP server over stdio for one project
folder. Reads are journaled in the project's runs.jsonl; writes are refused.`;

async function main(): Promise<void> {
  const rootArg = process.argv[2];

  if (rootArg === "--help" || rootArg === "-h") {
    process.stderr.write(`${USAGE}\n`);
    return;
  }
  if (!rootArg) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 1;
    return;
  }

  let project: ReadOnlyProject;
  try {
    project = await ReadOnlyProject.open(rootArg);
  } catch (error) {
    process.stderr.write(
      `${MCP_SERVER_NAME}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
    return;
  }

  // stdout belongs to the protocol; diagnostics go to stderr only.
  process.stderr.write(
    `${MCP_SERVER_NAME} ${MCP_SERVER_VERSION} serving "${project.manifest.name}" at ${project.root}\n`,
  );

  const server = createMcpServer(project);
  await server.connect(new StdioServerTransport());
}

void main();
