import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";

import type { ReadOnlyProject } from "./project.js";
import { ARTIFACT_RESOURCES, listSnapshotResources, readResource } from "./resources.js";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "./version.js";

/**
 * Builds the read-only MCP server for one project folder.
 *
 * Ground rules enforced here: resources only (the tool registry stays empty —
 * a host attempting any write gets a loud protocol error from the SDK, never a
 * silent no-op), and stdio is the only transport this package ever wires up.
 */
export function createMcpServer(project: ReadOnlyProject): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { capabilities: { resources: {} } },
  );

  for (const resource of ARTIFACT_RESOURCES) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        title: resource.title,
        description: resource.description,
        mimeType: resource.mimeType,
      },
      async (uri) => {
        const result = await readResource(project, uri.href);
        return { contents: [{ uri: uri.href, mimeType: result.mimeType, text: result.text }] };
      },
    );
  }

  const snapshots = new ResourceTemplate("openmerchant://snapshots/{id}", {
    list: async () => ({ resources: await listSnapshotResources(project) }),
  });
  server.registerResource(
    "snapshot",
    snapshots,
    {
      title: "Market snapshots",
      description: "One immutable snapshot of the competitor listing set, keyed by snapshot id.",
      mimeType: "application/json",
    },
    async (uri) => {
      const result = await readResource(project, uri.href);
      return { contents: [{ uri: uri.href, mimeType: result.mimeType, text: result.text }] };
    },
  );

  return server;
}
