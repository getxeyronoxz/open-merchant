import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "../src/version";

/**
 * The server tells every MCP host who it is. A frozen literal in this file
 * would outlive every release, which is exactly the defect the connector client
 * had: a hardcoded `1.0.0-alpha.4` answering against a number the app had
 * stopped being. The version is read from package.json so a release bump
 * carries it without anyone editing this file.
 */

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string; name: string };

const source = readFileSync(new URL("../src/version.ts", import.meta.url), "utf8");

describe("MCP server identity", () => {
  it("carries no frozen version literal in its own source", () => {
    // The equality check below passes today only because the literal and
    // package.json happen to agree at 1.0.0-alpha.0. This is the assertion
    // that fails if a literal is ever put back: it cannot be satisfied by a
    // coincidence.
    expect(source).not.toMatch(/\d+\.\d+\.\d+/u);
  });

  it("reports the version from its own package.json", () => {
    expect(MCP_SERVER_VERSION).toBe(manifest.version);
  });

  it("identifies as the product's read-only MCP lane, not as its npm package", () => {
    // The package is `@open-merchant/mcp` and the bin is `open-merchant-mcp`,
    // but what a host shows the seller is the product's read-only lane. Naming
    // it after the package would put a scoped registry name in the UI.
    expect(MCP_SERVER_NAME).toBe("open-merchant");
  });
});
