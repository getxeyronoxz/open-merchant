import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE_DIRECTORY = fileURLToPath(new URL("../src", import.meta.url));

/**
 * The renderer builds against this package's barrel: it imports
 * `createMockDesktopClient` for development outside Electron. That makes every
 * file here part of a browser bundle, so a single `node:` import would follow
 * the mock into the renderer and break the "the renderer never touches the
 * host" rule. There is no bundler config to catch it — this test is the guard.
 */
describe("SDK browser safety", () => {
  it("imports no node builtins from its runtime sources", async () => {
    const entries = await readdir(SOURCE_DIRECTORY, { withFileTypes: true });
    const sources = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".ts"));
    expect(sources.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const entry of sources) {
      const contents = await readFile(join(SOURCE_DIRECTORY, entry.name), "utf8");
      if (/^\s*import\s[^\n]*from\s+"node:/mu.test(contents)) {
        offenders.push(entry.name);
      }
    }

    expect(offenders).toEqual([]);
  });
});
