# `open-merchant-mcp`

<div align="center">

[![npm](https://img.shields.io/npm/v/open-merchant-mcp?color=cb3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/open-merchant-mcp)
[![License: AGPL-3.0](https://img.shields.io/npm/l/open-merchant-mcp?color=blue)](https://github.com/getxeyronoxz/open-merchant/blob/dev/LICENSE)
[![Downloads](https://img.shields.io/npm/dm/open-merchant-mcp?color=blue)](https://www.npmjs.com/package/open-merchant-mcp)
[![Read-only](https://img.shields.io/badge/writes-refused%20by%20construction-2ea44f)](https://github.com/getxeyronoxz/open-merchant)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)

</div>

A **local, read-only MCP server** for an Open Merchant project folder. Any MCP host — Claude Code,
Claude Desktop, opencode, an IDE agent, a local script — can spawn it:

```bash
npx --yes open-merchant-mcp /path/to/project
```

It reads the project: objective, evidence, competitors, market snapshots, economics, reports, and
the run and provenance journals. It has no network socket, no accounts, and no telemetry. It
**cannot write** — the server registers no tools at all, so a write attempt is refused at the
protocol level rather than by a check that could be bypassed. Every read is journaled to that
project's `runs.jsonl`.

Most people never run this directly: the server also ships **inside the
[Open Merchant](https://github.com/getxeyronoxz/open-merchant) app**, which hands you the exact
path and a ready-to-paste host config. Take this package when the server needs to follow a project
the app does not own, or when you would rather not install the app at all.

## Contents

- [Host configuration](#host-configuration)
- [Resources](#resources)
- [What it will not do](#what-it-will-not-do)
- [Building and verifying locally](#building-and-verifying-locally)

## Host configuration

Hosts disagree on the config key and the transport spelling, so a snippet written for one is not
read by another. `opencode` reads an `mcp` key with the transport spelled `local` and the command as
an array; Claude Code and Claude Desktop read `mcpServers` with `stdio`, a string command, and a
separate `args`.

**Claude Code / Claude Desktop** — in `.mcp.json`:

```json
{
  "mcpServers": {
    "open-merchant": {
      "type": "stdio",
      "command": "npx",
      "args": ["--yes", "open-merchant-mcp", "/path/to/project"]
    }
  }
}
```

**opencode** — in `opencode.jsonc`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "open-merchant": {
      "type": "local",
      "command": ["npx", "--yes", "open-merchant-mcp", "/path/to/project"],
      "enabled": true
    }
  }
}
```

> The app does not generate a `claude mcp add …` one-liner for you. Quoting that is correct in
> Windows `cmd` is wrong in PowerShell and a no-op in a POSIX shell, so there is no single correct
> escaper, and an incomplete one hands you a path that looks quoted and is not.

See [`docs/mcp-hosts.md`](https://github.com/getxeyronoxz/open-merchant/blob/dev/docs/mcp-hosts.md)
in the main repository for both formats with their sources.

## What it will not do

- **Write anything.** Zero tools are registered. There is no code path that mutates a project.
- **Reach the network.** stdio only; the package contains no network client.
- **Repair a malformed project.** Artifacts are validated against the shared schemas and a bad file
  is rejected loudly rather than fixed.
- **Follow a symlink out of the project.** Directory and artifact resolution goes through the
  known-layout guard, and a linked journal is refused during an audited read.

## Verification

The published bundle is exercised as a real child process, not a mock: initialize, list every
resource, read each URI, confirm the run journal grows, verify the tools capability is absent, and
attempt a write that must fail.

To reproduce that from a clone of the main repository:

```bash
pnpm --filter open-merchant-mcp test
```

---

The full application, its roadmap, and the rest of the release notes are in the
[main repository](https://github.com/getxeyronoxz/open-merchant).

**It ships inside the desktop app**, so most users never run the command above
themselves. `apps/desktop/stage-mcp.cjs` stages the built server into the app's
resources at build time, and the Plugins screen hands the user the exact path and
a host config for the project they have open.

It is also on npm, as a single self-contained binary with no runtime
dependencies — the same bundle the app ships. Useful when the server has to
follow a project the app does not own, or when the app's own install is not
available:

```bash
npx --yes open-merchant-mcp /path/to/project
```

## Ground rules (the draft gate, protocol edition)

- **Read-only by construction** — canonical artifacts cannot be written. The
  only mutation is a guarded audit append to the project's `runs.jsonl`, once per
  resource read; linked/malformed journals are refused rather than replaced.
- **stdio transport only** — no network socket, ever.
- **No tools** — resources only; the initialize response never advertises the
  tools capability. `tools/list` and write attempts fail as loud protocol errors,
  not silent no-ops.
- Artifacts are exposed exactly as the project stores them, validated against
  the workspace format v2 zod schemas in `@open-merchant/shared`; malformed
  data is rejected loudly rather than repaired.

## Resources

| URI | Artifact |
| --- | --- |
| `openmerchant://manifest` | `.openmerchant/manifest.json` (objective) |
| `openmerchant://evidence` | `evidence/sources.jsonl` |
| `openmerchant://competitors` | `market/competitors.json` |
| `openmerchant://snapshots` | index of `market/snapshots/` |
| `openmerchant://snapshots/{id}` | one immutable market snapshot |
| `openmerchant://economics/assumptions` | `economics/assumptions.json` |
| `openmerchant://economics/scenarios` | `economics/scenarios.json` |
| `openmerchant://reports/sections` | `reports/report-sections.json` |
| `openmerchant://reports/opportunity` | `reports/opportunity-report.md` |
| `openmerchant://journal/runs` | `.openmerchant/runs.jsonl` |
| `openmerchant://journal/provenance` | `.openmerchant/provenance.jsonl` |

## Host configuration

The config key and shape differ per host — opencode reads `mcp` with the command
as an array, Claude Code and Claude Desktop read `mcpServers`. The app generates
the right one; `docs/mcp-hosts.md` records both. This example is the
`mcpServers` form:

```json
{
  "mcpServers": {
    "open-merchant": {
      "command": "node",
      "args": ["/path/to/open-merchant/packages/mcp/dist/cli.mjs", "/path/to/project"]
    }
  }
}
```

Use an absolute path in both fields. The project folder must contain a valid
`.openmerchant/manifest.json`; malformed workspaces are refused, never repaired.

### Version compatibility

This server journals the `mcpArtifactRead` run operation, and reports its own
version from `package.json` — a frozen literal here outlived every release once
already. Use it with the coordinated Open Merchant `1.0.0` desktop build (or a
newer build carrying the same shared schema). Older alpha builds do not recognize
that run operation and may reject the journal, so do not point this server at a
project that must remain readable by an older alpha app.

## Build and verify locally

```bash
pnpm --filter open-merchant-mcp build
pnpm --filter open-merchant-mcp test
```

The test command rebuilds `dist/cli.mjs` first and includes a real spawned-child
stdio test: initialize, list all resources, read each URI, confirm the run
journal grows, verify the tools capability is absent, and attempt a write that
must fail. Use MCP Inspector, Claude Desktop, or an IDE host for manual verification.

## Troubleshooting

- **`not an Open Merchant project`** — point the host at the project root, not
  its parent folder.
- **`manifest is malformed`** — inspect or restore the canonical project through
  Open Merchant; the MCP server intentionally never repairs it.
- **No resources after a tool appears** — the server advertises resources only;
  update the host to MCP resources, not tool calls.
- **Read appears in the project journal** — expected. Every successful resource
  read appends one `mcpArtifactRead` record with the exact served-byte hash.
