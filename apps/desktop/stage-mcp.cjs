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

const { chmodSync, copyFileSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const root = __dirname;
const source = join(root, "..", "..", "packages", "mcp", "dist", "cli.mjs");
const target = join(root, "resources", "mcp");

/** Must match `executableName` in electron-builder.yml. */
const EXECUTABLE = "open-merchant";

// Cleared first, because this directory is entirely generated (it is
// gitignored) and staging is per-platform. Without this, rebuilding for a
// different target leaves the previous platform's launcher behind, and a build
// ships a .cmd to a Mac or a shell script to Windows.
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

const bundle = join(target, "open-merchant-mcp.mjs");
copyFileSync(source, bundle);
chmodSync(bundle, 0o755);

// A launcher is staged for every platform rather than handing a host the bare
// bundle, for two reasons that both bite on macOS and Linux specifically:
//
//  1. A host spawns the command directly, so the executable bit has to have
//     survived being copied into a DMG, an AppImage, or a snap. A launcher
//     that is a shell script has the same requirement, but it can also fall
//     back to an interpreter instead of failing outright.
//  2. `node` is often simply absent. Someone who installed a desktop app may
//     never have installed Node, and on macOS especially a GUI-launched app
//     has a minimal PATH. Electron ships with the app, so the launcher prefers
//     the Node runtime that is guaranteed to be there.
const POSIX_LAUNCHER = `#!/bin/sh
# Runs the bundled read-only MCP server, preferring the Node runtime that ships
# with Open Merchant so no separate Node install is required.
#
# Written by apps/desktop/stage-mcp.cjs. Edit that, not this.
set -eu

# Resolve this script's own directory with parameter expansion rather than
# \`dirname\`, so the launcher depends on nothing outside the shell itself. A
# host may spawn it from a minimal environment, and a launcher that cannot
# answer "where am I" fails before it can say why.
case "$0" in
  */*) here=\${0%/*} ;;
  *) here=. ;;
esac
here=$(CDPATH= cd -- "$here" && pwd)
script="$here/open-merchant-mcp.mjs"

# The app bundle puts the executable in different places per platform: inside
# Contents/MacOS on macOS, and at the root of the install elsewhere. Try the
# packaged layouts before falling back to whatever node is on PATH.
for candidate in "$here/../../MacOS/${EXECUTABLE}" "$here/../../${EXECUTABLE}"; do
  if [ -x "$candidate" ]; then
    ELECTRON_RUN_AS_NODE=1
    export ELECTRON_RUN_AS_NODE
    exec "$candidate" "$script" "$@"
  fi
done

if ! command -v node >/dev/null 2>&1; then
  echo "open-merchant-mcp: no Node runtime found." >&2
  echo "" >&2
  echo "This copy of Open Merchant should ship its own, so this usually means" >&2
  echo "the app is installed somewhere unusual. You can also point Open" >&2
  echo "Merchant at a Node you have installed, or run the server directly:" >&2
  echo "" >&2
  echo "  node \\"$script\\" <project-folder>" >&2
  exit 1
fi

# A Linux box with an old distro node on PATH is common enough to be worth
# naming: the server is bundled for a modern runtime, and a Node 16 would fail
# on syntax long before it failed on anything a seller could read.
major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$major" -lt 20 ] 2>/dev/null; then
  echo "open-merchant-mcp: the Node on PATH is too old (found v$major, need 20+)." >&2
  echo "" >&2
  echo "Open Merchant ships its own Node runtime and normally uses that, so this" >&2
  echo "usually means the install looks unusual. To use a specific Node instead," >&2
  echo "set OPEN_MERCHANT_NODE to its path before starting this server." >&2
  exit 1
fi

exec node "$script" "$@"
`;

// Staged per platform. The release matrix builds each OS on its own runner, so
// a macOS build carries only what a Mac can run — a .cmd in there is clutter in
// a folder a user might open and wonder about.
//
// `--posix` / `--windows` stage for the named platform instead of this machine's.
// The owner's machine is Windows, and without this the POSIX launcher could not
// be produced — let alone tested — outside CI.
const forced = process.argv.slice(2).find((arg) => arg === "--posix" || arg === "--windows");
const isWindows = forced === "--windows" ? true : forced === "--posix" ? false : process.platform === "win32";

if (!isWindows) {
  // LF endings, not CRLF: a /bin/sh script with carriage returns fails on the
  // shebang line with an error that points nowhere near the cause.
  writeFileSync(join(target, "open-merchant-mcp"), POSIX_LAUNCHER, "utf8");
  chmodSync(join(target, "open-merchant-mcp"), 0o755);
}

// Windows: a host cannot spawn a bare .mjs at all, and the .cmd carries CRLF
// because cmd.exe requires it.
if (isWindows) {
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
}

process.stdout.write(`staged MCP server into ${target}\n`);
