// Stages the read-only MCP server into the app bundle.
//
// The server used to be reachable only by someone with this repository checked
// out: `packages/mcp` is a private, unpublished package and the installer ships
// `out/**` alone. Staging the built CLI into `resources/mcp` is what puts it in
// a released build, always at a path that matches the app that carries it.
//
// Plain .cjs because electron-builder and this script both run under the
// desktop package, which is "type": "module" — the repo already uses .cjs for
// its build-time helpers (record.cjs, update-feed-server.cjs).

const { chmodSync, copyFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const root = __dirname;
const source = join(root, "..", "..", "packages", "mcp", "dist", "cli.mjs");
const target = join(root, "resources", "mcp");

/** Must match `executableName` in electron-builder.yml. */
const EXECUTABLE = "open-merchant";

mkdirSync(target, { recursive: true });

const bundle = join(target, "open-merchant-mcp.mjs");
copyFileSync(source, bundle);
// Spawned directly by an MCP host on macOS and Linux, so it has to be runnable.
chmodSync(bundle, 0o755);

// A host cannot spawn a bare .mjs on Windows. The obvious shim needs `node` on
// PATH, which a seller who installed a desktop app may not have — so this uses
// the Node runtime the app already ships. ELECTRON_RUN_AS_NODE makes the
// Electron binary behave as plain Node, which is the same trick the app's own
// dev tooling relies on.
writeFileSync(
  join(target, "open-merchant-mcp.cmd"),
  [
    "@echo off",
    "rem Runs the bundled read-only MCP server using the Node runtime that ships",
    "rem with Open Merchant, so no separate Node install is required.",
    "set ELECTRON_RUN_AS_NODE=1",
    `"%~dp0..\\..\\${EXECUTABLE}.exe" "%~dp0open-merchant-mcp.mjs" %*`,
    "",
  ].join("\r\n"),
  "utf8",
);

process.stdout.write(`staged MCP server into ${target}\n`);
