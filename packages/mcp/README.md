# `@open-merchant/mcp`

Phase 3, build-order item 1: Open Merchant as a **local, read-only MCP server**.
Any MCP host (Claude Desktop, an IDE agent, a local script) can spawn it against
one project folder:

```bash
open-merchant-mcp /path/to/project
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

## Host configuration example (Claude Desktop)

```json
{
  "mcpServers": {
    "open-merchant": {
      "command": "node",
      "args": ["/path/to/open-merchant/packages/mcp/dist/cli.js", "/path/to/project"]
    }
  }
}
```

Use an absolute path in both fields. The project folder must contain a valid
`.openmerchant/manifest.json`; malformed workspaces are refused, never repaired.

### Version compatibility

This server journals the `mcpArtifactRead` run operation. Use it with the
coordinated Open Merchant `v1.0.0` desktop build (or a newer build carrying the
same shared schema). Older alpha builds do not recognize that run operation and
may reject the journal; do not point this pre-release MCP server at a project
that must remain readable by an older alpha app.

## Build and verify locally

```bash
pnpm --filter @open-merchant/mcp build
pnpm --filter @open-merchant/mcp test
```

The test command rebuilds `dist/cli.js` first and includes a real spawned-child
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
