# Phase 3 research — the connected workbench

Findings behind the Phase 3 rewrite in `ROADMAP.md` (research date: 2026-09). This
document is evidence for roadmap decisions, not a product promise.

## Competitive landscape

| Tool | Job | Price | Model | What it can't do |
| --- | --- | --- | --- | --- |
| Jungle Scout | Bottom-up product validation; sales estimates (~84% accuracy, independently tested) | from $49/mo | Cloud SaaS, accounts | Show *why* the number is what it is; keep your data |
| Helium 10 | All-in-one: research + listings + PPC + analytics | from $99/mo | Cloud SaaS | Anything outside the subscription; auditability |
| SmartScout | Top-down market/brand intelligence (1.5M brand DB, Traffic Graph) | from $29/mo | Cloud SaaS | Product-level launch validation (different job) |
| Minea | AI scans 100M+ ads/stores/trends to surface "winning products" | subscription | Cloud, AI-decides | Defensibility — "why this product?" is unknowable |
| Sell The Trend / Dropship.io | AI copilot over a 9M+ product sales-estimate DB | ~$50–100/mo | Cloud SaaS | Verified math; persistent decision record |
| ChatGPT/Claude ad-hoc | General research | $20/mo | Chat scrollback | Structure, math guarantees, persistence, provenance |

Observations that shaped Phase 3:

- Serious sellers commonly run **two** estimate tools ($80–150/mo, ~$1,000–1,800/yr)
  because each covers a different workflow stage. Nobody covers the *decision record*.
- The entire AI-native category (Minea et al.) optimizes speed of suggestion; none
  optimizes defensibility of the decision. "AI drafts; humans accept; everything
  journaled" is unoccupied territory.
- Estimates are someone else's black box. Open Merchant deliberately does not ship
  sales estimates; it ships the record of a *verified* decision. This is a stance,
  and Phase 3 connectors must not smuggle estimates in as if they were facts —
  connector output enters as drafts labelled with origin.

## MCP (Model Context Protocol) — the connector standard, current state

- The spec is settled and versioned (2026-07-28 line), with an official registry.
- Architecture: host ↔ client ↔ server. A host (Claude Desktop, VS Code) spawns one
  client per server. Local servers use **stdio** transport (single client, spawned
  child process); remote servers use streamable HTTP.
- The official TypeScript SDK v2 is the stable release line:
  `@modelcontextprotocol/server` (`McpServer`, `registerTool`, `registerResource`)
  with `StdioServerTransport` from `@modelcontextprotocol/server/stdio`. Servers
  declare schemas with zod.
- Human-in-the-loop is a protocol feature: **elicitation** lets a server ask the
  user for input mid-flow; tool discovery changes arrive via notifications. The
  "user triggers each fetch explicitly" rule maps cleanly onto this — the user is
  in the protocol, not just in our UI policy.
- Consequence for Phase 3: "MCP-style connectors" (old text) becomes two concrete
  deliverables — Open Merchant **as an MCP server** (read-only, stdio) and Open
  Merchant **as an MCP client** (connectors are local stdio servers whose output
  lands in the inbox as drafts).

## Plugin manifest precedent — Obsidian

Obsidian's `manifest.json` (required fields): `id` (lowercase-hyphen, unique),
`name`, `version` (semver), `author`, `minAppVersion`, `description`,
`isDesktopOnly`; optional `authorUrl`, `fundingUrl`. Lessons adopted for the Phase
3 plugin surface:

- Author is a required field — trust starts with knowing who wrote the thing.
- `minAppVersion` prevents silent breakage across app versions.
- We extend the manifest with explicit `reads` / `writes` / `network` capability
  declarations; Obsidian relies on review + community, we can enforce at load time
  because our plugins run through zod-validated channels anyway.

## Positioning sentence supported by this research

> Jungle Scout sells you a number. Minea sells you a hunch. Open Merchant produces
> a decision you can defend — evidence, math, and the AI's contribution all on the
> record.
