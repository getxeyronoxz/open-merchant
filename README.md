# Open Merchant

Open Merchant is an artifact-first, local-first Windows workspace for deciding whether a product opportunity looks commercially attractive—without losing the evidence, assumptions, calculations, and report behind the decision.

Open Merchant V0 is for solo ecommerce sellers, founders, and product researchers who want one inspectable project folder instead of disconnected tabs, spreadsheets, and notes.

## What Open Merchant is

Create a project, record a research objective and evidence, compare competitors, enter costs and selling-price scenarios, calculate deterministic unit economics, and generate a Markdown opportunity report. The project remains a normal local folder that you own and can inspect outside the app.

The working sample project is [Mechanical Keyboards India](examples/mechanical-keyboards-india).

## Windows prerequisites

- Windows 11 (V0 is Windows-only).
- Node.js 22 or newer with npm.
- Rust stable with the MSVC toolchain.
- Microsoft WebView2 Runtime (included with current Windows 11 installations).
- Git.

## Development

```powershell
npm ci
npm run tauri dev
```

The desktop app opens a folder chooser when creating a project. Choose a location you control; Open Merchant creates a new project folder there and does not use a cloud account.

## Workflow

1. Create or open a project.
2. Set the research objective.
3. Add evidence with URLs, notes, observations, and timestamps.
4. Add competitor listings and inspect min, max, average, and median prices.
5. Enter acquisition, shipping, marketplace, payment, and other cost assumptions.
6. Set low, base, and high selling-price scenarios; calculate margins.
7. Add the decision summary, observations, risks, and opportunities.
8. Generate the evidence-linked Markdown report.
9. Inspect the saved JSON, JSONL, CSV, Markdown, run, and provenance artifacts.
10. Close the app and reopen the same local project.

## Workspace format

Each project is an ordinary directory. The user-owned files are the canonical state:

```text
mechanical-keyboards-india/
  merchant-project.json
  sources/sources.jsonl
  market/competitors.csv
  economics/assumptions.json
  economics/scenarios.csv
  reports/report-sections.json
  reports/opportunity-report.md
  .merchant/runs.jsonl
  .merchant/provenance.jsonl
```

`runs.jsonl` records meaningful generation operations. `provenance.jsonl` links generated output files to their run IDs and SHA-256 fingerprints. The app’s artifact viewer reads only this known project layout; it does not expose arbitrary files from the computer.

Open Merchant uses crash-safe replacement when saving its own workspace artifacts and recent-project list. If report generation is interrupted, its failed run remains visible in History with recovery guidance; any artifacts written before the interruption are retained for inspection instead of being silently removed.

## Deterministic calculations

All commerce calculations run in tested application code using fixed decimal values—not an LLM and not JavaScript floating-point arithmetic.

For each selling-price scenario:

```text
marketplace fee = selling price × marketplace fee rate / 100
payment fee     = selling price × payment fee rate / 100
total cost      = acquisition + shipping + marketplace fee + payment fee + other costs
gross profit    = selling price − total cost
gross margin    = gross profit / selling price × 100
```

Competitor statistics ignore listings without a price and calculate min, max, average, and median from valid prices only.

## Architecture

The React desktop UI calls a narrow Tauri application layer. Portable Rust crates hold the commerce domain and workspace storage rules. Windows/Tauri behavior stays at the desktop boundary, while calculations and file formats remain independent of the platform.

## Testing

```powershell
cargo test --workspace --all-targets
npm run test:run
```

The Rust suite covers workspace persistence, validation, decimal economics, competitor statistics, report generation, provenance, and a complete create → report → reopen workflow. The frontend suite covers the project workflow and key editing screens.

## Windows build

```powershell
npm run tauri build -- --bundles nsis
```

The unsigned NSIS installer is written under `target\release\bundle\nsis`. Windows may show a SmartScreen warning for an unsigned early build. Review the release source and installer provenance before installing; user project folders remain outside the installation directory.

## Current limitations

- Windows only; Linux and macOS releases are not part of V0.
- No cloud sync, accounts, teams, or mobile application.
- No chatbot, LLM provider, automatic research, web scraping, or browser automation.
- No marketplace, supplier, inventory, CRM, accounting, advertising, payment, or purchasing integrations.
- V0 expects one writer at a time per project. Do not edit a project in another tool while Open Merchant has unsaved changes.
- Evidence and pricing in the checked-in sample project are clearly marked demo data, not live commercial claims.

## License

Open Merchant is licensed under the GNU Affero General Public License v3.0
only (`AGPL-3.0-only`).

Copyright © 2026 Xeyronox.

## Contributing and support

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development and pull-request guidance, [CHANGELOG.md](CHANGELOG.md) for release notes, [SUPPORT.md](SUPPORT.md) for help and issue routing, and [SECURITY.md](SECURITY.md) for private vulnerability reporting. Community participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
