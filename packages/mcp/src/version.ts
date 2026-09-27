// Sourced from the package manifest rather than written here: a literal in this
// file outlives every release, and this server tells each MCP host which
// version answered. Bumping `packages/mcp/package.json` is the only edit needed.
// (The connector client had exactly this bug, which is why a test forbids a
// semver appearing anywhere in this file — including in a comment.)
import packageJson from "../package.json" with { type: "json" };

/** Identity of this server, kept in one place for CLI output and run records. */
export const MCP_SERVER_NAME = "open-merchant";
export const MCP_SERVER_VERSION: string = packageJson.version;

/** The published package name, for usage text that should name the real thing. */
export const MCP_PACKAGE_NAME: string = packageJson.name;
