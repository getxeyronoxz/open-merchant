import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const CONNECTOR_ID = "sample-market";

/**
 * Writes a valid connector manifest into app data and returns its id. Used by
 * the connector suites; the manifest is a fixture, not a runnable server.
 */
export async function writeConnectorPlugin(
  userData: string,
  overrides: { id?: string; enabled?: boolean; writes?: string[] } = {},
): Promise<string> {
  const id = overrides.id ?? CONNECTOR_ID;
  const dir = join(userData, "plugins", id);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "manifest.json"),
    `${JSON.stringify(
      {
        id,
        name: "Sample market",
        version: "1.0.0",
        author: "Open Merchant",
        minAppVersion: "1.0.0",
        capabilities: {
          reads: ["market"],
          writes: overrides.writes ?? ["drafts"],
          network: true,
        },
        kind: "connector",
        description: "A sample market-data connector used by the test suite.",
        toolName: "fetch_market",
        command: "node",
        args: ["server.js"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  if (overrides.enabled) {
    const { PluginStore } = await import("../../src/main/plugin-store");
    await new PluginStore(userData).setEnabled(id, true);
  }
  return id;
}
