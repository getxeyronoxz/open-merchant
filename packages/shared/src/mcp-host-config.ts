/**
 * The MCP host config snippet.
 *
 * The read-only MCP server ships inside the app, but the path to it is not
 * something a seller should have to work out: on Windows it sits under
 * `Program Files`, and an MCP host needs that exact path plus the project
 * folder as an argument. Producing the snippet in the main process, where the
 * resolved path is known, is what turns an undiscoverable feature into one
 * click from working.
 *
 * `JSON.stringify` is the whole implementation, and that is deliberate: a
 * hand-built string is how a Windows path ends up with unescaped backslashes
 * (invalid JSON) and how a quote in a folder name escapes into a second
 * server entry.
 */

/** The name a host shows for this server; matches the server's own identity. */
export const MCP_HOST_CONFIG_NAME = "open-merchant";

export function mcpHostConfig(command: string, projectRoot: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        [MCP_HOST_CONFIG_NAME]: { command, args: [projectRoot] },
      },
    },
    null,
    2,
  );
}
