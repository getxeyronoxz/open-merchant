# `@open-merchant/mcp`

Phase 3, build-order item 1: Open Merchant as a **local, read-only MCP server**.
Any MCP host (Claude Desktop, an IDE agent, a local script) can spawn it against
one project folder:

```bash
open-merchant-mcp /path/to/project
```

## Ground rules (the draft gate, protocol edition)

- **Read-only by construction** — the server imports no artifact-writing API
  from `@open-merchant/core`. The only write in this package is appending an
  audit line to the project's `runs.jsonl` run journal, once per resource read.
- **stdio transport only** — no network socket, ever.
- **No tools** — resources only; the tool list is empty and stays empty. Write
  attempts from a host surface as loud protocol errors, not silent no-ops.
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
