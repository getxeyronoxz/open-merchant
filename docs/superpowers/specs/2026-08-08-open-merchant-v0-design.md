# Open Merchant V0 Design (historical planning record)

> This approved planning record captures the 2026-08-08 design direction. For shipped behavior, repository layout, and verification, use [README.md](../../../README.md), [architecture.md](../../architecture.md), and [manual-smoke-test.md](../../manual-smoke-test.md).

**Status:** Historical planning direction; superseded by the current product documentation
**Date:** 2026-08-08
**Milestone:** Credible Windows public prototype in approximately two weeks

## 1. Summary

Open Merchant V0 is a local-first Windows desktop workspace for researching whether a product opportunity is commercially attractive. It brings a research objective, source evidence, competitor pricing, cost assumptions, deterministic unit economics, and an opportunity report into one durable project folder.

The application is not a chatbot. Its primary product is a collection of normal, inspectable files owned by the user. The desktop interface is a structured editor, calculation engine, report generator, and artifact viewer for those files.

V0 deliberately excludes AI, web scraping, marketplace integrations, cloud services, accounts, collaboration, inventory, purchasing, and ecommerce operations. The milestone proves one complete workflow from project creation to a persistent, evidence-linked opportunity report.

Delivery is timeboxed for a solo founder. The complete user-facing vertical slice is the public-prototype gate. Production hardening remains architecturally supported but cannot delay that gate.

## 2. Target User and Job

The primary user is one small ecommerce seller, solo founder, product researcher, marketplace seller, or prospective merchant evaluating one product opportunity at a time.

The user's job is:

> Given the available evidence, competitor prices, and my cost assumptions, decide whether this product opportunity appears commercially interesting and preserve an inspectable explanation of that decision.

The user collects and enters research manually. Open Merchant structures the evidence, performs reliable calculations, produces readable artifacts, and preserves the inputs behind them.

## 3. Product Principles

1. **Artifacts over chat.** The persistent workspace and its files are the product; conversation is not the primary interaction.
2. **Local-first ownership.** Project data lives in a user-selected folder and remains useful without an account, service, or network connection.
3. **Deterministic commerce math.** Financial calculations and price statistics use tested application code and decimal arithmetic, never an LLM or binary floating-point.
4. **Inspectable conclusions.** Generated reports cite source IDs and derive figures from saved inputs.
5. **Explicit provenance.** Meaningful generation operations record their inputs, outputs, timestamps, and hashes.
6. **One excellent vertical slice.** V0 supports one coherent research workflow instead of many partial ecommerce features.
7. **Portable core, Windows-first shell.** Domain and workspace logic are platform-independent. Windows-specific behavior stays at the desktop boundary.
8. **No speculative architecture.** Components exist only where they create a clear testable boundary needed by V0.

## 4. V0 Scope

### 4.1 Included

- Windows 11 desktop application
- Create a project in a user-selected parent folder
- Open an existing Open Merchant project folder
- Recent-project shortcuts stored in application data
- One open project at a time
- Project title, objective, and currency
- Source/evidence records with observations and timestamps
- Competitor records and price comparison
- Editable cost assumptions
- Low, base, and high selling-price scenarios
- Deterministic fees, total cost, gross profit, and gross margin
- Deterministic minimum, maximum, average, and median competitor price
- User-authored market observations, decision summary, risks, and opportunities
- Deterministically generated Markdown opportunity report
- CSV, JSON, JSONL, and Markdown artifacts
- Read-only in-app artifact viewer
- Open the project folder in Windows Explorer
- Basic generation history and artifact provenance
- Persistence across application restarts
- Automated domain, workspace, report, and focused UI tests
- Windows production build and a basic unsigned NSIS installer
- Example mechanical-keyboard project
- README, AGPL-3.0-only license, screenshots, and demo-ready sample data

### 4.2 Explicitly Excluded

- Chatbot or chat-style primary interface
- LLM providers, API keys, AI extraction, AI drafting, or AI recommendations
- Browsing, scraping, crawling, or embedded remote web content
- Marketplace, supplier, Shopify, Amazon, Alibaba, advertising, payment, or accounting integrations
- Automatic competitor discovery
- CSV import or migration from other tools
- Taxes, GST, customs duties, currency conversion, or exchange rates
- Arbitrary cost-line or formula builders
- Multiple currencies inside one project
- Product catalogues, inventory, CRM, purchasing, and supplier communication
- User accounts, login, teams, permissions, cloud sync, and mobile
- Linux and macOS releases
- Plugins, microservices, background agents, or autonomous workflows
- Live multi-process or multi-user file collaboration
- Automatic updates, telemetry, analytics, or crash-reporting services
- Code signing unless signing credentials already exist outside the repository

### 4.3 Delivery Priority and Timebox

Implementation follows this binding order:

1. Create, open, and reopen a project
2. Research objective
3. Evidence records
4. Competitor table
5. Deterministic competitor statistics
6. Economics inputs
7. Deterministic unit-economics calculations
8. Markdown opportunity-report generation
9. Persistence as normal local artifacts
10. Basic artifact viewer
11. Basic run and provenance history
12. Windows production build
13. Example project
14. README
15. Three screenshots
16. Demo-ready workflow

Each item must work through the user interface and persist through application restart before later items receive polish. Automated tests are written with each implementation task, especially for domain calculations, workspace round trips, and report generation; testing is not deferred to the end.

After all 16 items work reliably, remaining time may be spent on:

- External-file conflict detection
- Richer provenance inspection
- Additional hashing and integrity validation
- Sophisticated save recovery
- CI and installer polish
- Secondary UX refinement

These hardening items remain compatible with the architecture but are not completion criteria for the first public Windows prototype. An incomplete hardening item is removed or disabled rather than allowed to destabilize the vertical slice. No feature from outside V0 may replace these priorities.

## 5. User Experience

### 5.1 Start Screen

The start screen has three actions:

- **Create project** opens a native folder chooser, asks for a project name, objective, and ISO 4217 currency, and creates a sanitized child folder. If that folder already exists, creation stops and asks for a different name; existing contents are never reused or overwritten.
- **Open project** opens a native folder chooser and validates the selected folder before displaying it.
- **Recent projects** lists previously opened paths. Missing paths are shown as unavailable and can be removed from the list.

Creating a project defaults the currency to INR but permits another three-letter currency code. A project uses one currency for all competitor and economics values.

### 5.2 Workspace Shell

The project window uses one stable desktop layout:

- Top bar: project name, folder path, save status, and **Open in Explorer**.
- Left navigation: Objective, Evidence, Competitors, Economics, Report, Files & History.
- Main content: the active structured workspace section.

The interface uses form controls, editable tables, summaries, and document previews. There is no prompt box, chat transcript, or assistant persona.

Structured input changes save automatically after 500 milliseconds without another edit. The top bar displays **Saving**, **Saved**, or **Save failed**. A failed save keeps the in-memory edit and presents a retry action.

### 5.3 Objective

The Objective section edits:

- Project name
- Research objective
- Project currency

Changing currency after priced competitor or economics records exist is blocked. The user must remove those priced records first; V0 does not perform conversion.

### 5.4 Evidence

The Evidence section displays source cards or rows and a focused editor. A source contains:

- Stable source ID such as `S-001`
- URL using `http` or `https`
- Source title
- Notes
- One or more observations, each with label, value, optional unit, and note
- Observed timestamp
- Created and updated timestamps

URL, source title, and observed timestamp are required. Notes and observations are optional so a source can be captured before detailed extraction. URLs open in the system browser. Open Merchant does not fetch or embed the page. Source IDs remain stable after reordering or deletion so report references do not silently change.

### 5.5 Competitors

The Competitors section uses an editable table containing:

- Stable competitor ID
- Product
- Brand or company
- Price
- Project currency
- Marketplace or source name
- URL
- Optional source ID
- Notes
- Observed timestamp

The section shows the valid-price count, minimum, maximum, arithmetic mean, and median. Missing prices are allowed but excluded from statistics. Invalid and differently denominated values are rejected.

### 5.6 Economics

The Economics section has one shared cost-assumption form:

- Product or acquisition cost
- Shipping and logistics
- Marketplace fee percentage
- Payment fee percentage
- Other costs

It also has exactly three selling-price scenarios:

- Low
- Base
- High

Each scenario has one editable expected selling price. The application shows calculated fee amounts, total cost, gross profit, and gross margin as read-only values.

Competitor minimum, median, and maximum appear as suggestions beside the scenario prices. The user may copy them, but Open Merchant does not silently replace user-entered scenario values.

Editing assumptions immediately updates the preview in memory and marks the generated scenarios artifact as out of date. **Calculate and save scenarios** validates the inputs, writes the generated CSV, and records a successful or failed calculation run.

### 5.7 Report

The Report section collects structured, user-authored material:

- Decision summary
- Market observations
- Risks
- Opportunities

Each observation, risk, or opportunity can reference zero or more stable source IDs. The screen also shows a Markdown preview.

**Generate report** performs one application workflow:

1. Save and validate all current structured inputs.
2. Recalculate and save the economics scenarios.
3. Recalculate competitor statistics.
4. Generate the Markdown report from current data and narrative sections.
5. Hash the input and output artifacts.
6. Append run and provenance records.

This ensures the report cannot be generated against stale calculations.

When the user invokes report generation, one `report-generated` run owns both refreshed outputs: `economics/scenarios.csv` and `reports/opportunity-report.md`. A separate `economics-generated` run is recorded only when the user invokes **Calculate and save scenarios** directly.

### 5.8 Files & History

This section contains:

- A tree of known project artifacts
- A safe read-only viewer for UTF-8 JSON, JSONL, CSV, and Markdown files
- A run list showing operation, time, status, inputs, and outputs
- Provenance details for a selected generated artifact
- **Open in Explorer**

The viewer reads only known workspace-relative files. It does not become a general filesystem browser or editor. Markdown is rendered with raw HTML disabled.

## 6. Workspace Format

The initial workspace layout is:

```text
mechanical-keyboards-india/
  merchant-project.json

  sources/
    sources.jsonl

  market/
    competitors.csv

  economics/
    assumptions.json
    scenarios.csv

  reports/
    report-sections.json
    opportunity-report.md

  .merchant/
    runs.jsonl
    provenance.jsonl
```

`merchant-project.json`, `sources.jsonl`, `competitors.csv`, `assumptions.json`, and `report-sections.json` are source data. `scenarios.csv` and `opportunity-report.md` are generated artifacts. `.merchant` contains application-managed append-only records.

Every JSON object and JSONL record includes `schemaVersion: 1`. CSV files include a `schema_version` column. UTF-8 without a byte-order mark and `\n` line endings are used consistently so projects remain Git-friendly across platforms.

### 6.1 Project Manifest

`merchant-project.json` contains:

- `schemaVersion`
- `projectId` as UUID
- `name`
- `objective`
- `currency`
- `createdAt`
- `updatedAt`

The presence and validity of this manifest identifies an Open Merchant project.

### 6.2 Sources

Each line of `sources/sources.jsonl` is one complete source record. An observation value is stored as text with an optional unit because evidence may be numeric, qualitative, approximate, or a range. Source files are rewritten atomically when a record is edited; JSONL is selected for inspectability and future append/import workflows, not as an append-only restriction.

### 6.3 Competitors

`market/competitors.csv` columns are:

```text
schema_version,id,product,brand,price,currency,marketplace,url,source_id,notes,observed_at
```

Money values are canonical decimal strings with at most two fractional digits in V0. Newlines, commas, and quotes in text fields use standard CSV escaping.

### 6.4 Economics Inputs and Output

`economics/assumptions.json` contains the five shared cost inputs and three scenario selling prices. Amounts and percentage rates are decimal strings.

`economics/scenarios.csv` columns are:

```text
schema_version,scenario,selling_price,acquisition_cost,shipping_cost,marketplace_fee_rate,marketplace_fee,payment_fee_rate,payment_fee,other_costs,total_cost,gross_profit,gross_margin_percent
```

The generated file repeats inputs intentionally so it remains understandable outside the app. Derived columns are never trusted as calculation inputs.

### 6.5 Report Inputs and Output

`reports/report-sections.json` contains the user-authored decision summary and arrays of observations, risks, and opportunities. Each array item has a stable ID, text, and list of referenced source IDs.

`reports/opportunity-report.md` contains:

1. Title and generation metadata
2. Research objective
3. Decision summary
4. Market observations with evidence references
5. Competitor summary and price statistics
6. Pricing and unit-economics scenarios
7. Cost assumptions
8. Risks
9. Opportunities
10. Evidence index with source titles and URLs
11. Provenance footer containing the generating run ID

Narrative sections are never invented. Empty user-authored sections are rendered as clearly marked “No observations recorded” text rather than synthetic advice.

### 6.6 Run and Provenance Records

Meaningful operations are `project-created`, `economics-generated`, and `report-generated`. Routine debounced edits do not create run-history noise.

Each `.merchant/runs.jsonl` record contains:

- Schema version and run UUID
- Operation type
- Start and completion timestamps
- Status: succeeded or failed
- Application version
- Input artifact paths and SHA-256 hashes
- Output artifact paths and SHA-256 hashes
- Referenced source IDs
- A safe error summary for failed runs

Each `.merchant/provenance.jsonl` record contains:

- Schema version
- Artifact-relative path and SHA-256 hash
- Generation timestamp
- Generating run ID
- Input artifact paths and hashes
- Referenced source IDs

Both files are append-only. V0 does not provide pruning or historical artifact restoration.

## 7. Deterministic Commerce Rules

All money and percentage operations use a decimal type. Currency values are rounded to two fractional digits using midpoint-away-from-zero rounding when a derived currency amount is materialized. Percentage results are rounded to two fractional digits for display and CSV output. Internal intermediate values retain decimal precision until output rounding.

For each scenario:

```text
marketplace_fee = selling_price × marketplace_fee_rate ÷ 100
payment_fee     = selling_price × payment_fee_rate ÷ 100

total_cost =
  acquisition_cost
  + shipping_cost
  + marketplace_fee
  + payment_fee
  + other_costs

gross_profit = selling_price − total_cost
gross_margin_percent = gross_profit ÷ selling_price × 100
```

Validation rules:

- Monetary inputs must be zero or greater.
- Selling price must be greater than zero.
- Fee rates must be from 0 through 100 inclusive.
- A negative gross profit is valid and displayed clearly.
- All priced records must use the project currency.

Competitor statistics use only valid non-negative prices:

- Minimum and maximum are the sorted endpoints.
- Average is the arithmetic mean.
- Odd-count median is the middle sorted value.
- Even-count median is the arithmetic mean of the two middle values.
- An empty valid-price set produces no statistic, not zero.

## 8. Technical Architecture

### 8.1 Selected Stack

- Tauri 2 desktop shell
- React and TypeScript UI
- Vite frontend build
- Rust application, domain, and storage logic
- npm with a committed lockfile
- Tailwind CSS plus a small local component layer for a consistent showcase UI
- Vitest and React Testing Library for focused frontend tests
- Rust unit and integration tests
- GitHub Actions on `windows-latest` after the vertical slice passes locally
- NSIS Windows installer

No Redux, Zustand, database, ORM, server, or generated plugin system is needed. React component state and a small project context are sufficient for one open project.

### 8.2 Code Boundaries

```text
React UI
  -> typed desktop client
    -> Tauri commands
      -> application workflows
        -> merchant-core
        -> merchant-workspace
          -> selected project folder
```

The planned Rust workspace contains:

- `merchant-core`: domain types, validation, decimal calculations, competitor statistics, and report-ready summaries. It has no filesystem, Tauri, or Windows dependency.
- `merchant-workspace`: known relative paths, serialization, parsing, atomic writes, hashing, run/provenance append, and project validation. It depends on core data types but not Tauri.
- `src-tauri` application module: use cases that coordinate core and workspace behavior.
- `src-tauri` desktop adapter: Tauri commands, native folder dialogs, recent-project application data, external URL opening, and Windows Explorer integration.

The TypeScript UI accesses the backend through one typed client interface. Components do not call Tauri directly. Rust remains authoritative for persistence and domain validation; client-side validation exists only for immediate feedback.

### 8.3 Application Workflows

The public application operations are intentionally small:

- Create project
- Open project
- Load project snapshot
- Save project metadata
- Save sources
- Save competitors
- Save economics assumptions
- Calculate and persist scenarios
- Save report sections
- Generate report
- List and read known artifacts
- List runs and provenance
- Open URL in system browser
- Open project folder in Explorer

Each operation accepts and returns serializable data transfer objects. Desktop-specific types do not leak into the core.

## 9. Data Flow and Persistence

On project open, the workspace layer validates the manifest, supported schema version, expected paths, and source-data files. It parses a complete project snapshot before the UI replaces its current state. A malformed file never produces a partially loaded project.

For structured edits:

1. The UI validates basic field shape.
2. A 500-millisecond debounce groups keystrokes.
3. The application workflow performs authoritative validation.
4. The workspace layer writes to a temporary file beside the destination.
5. The completed temporary file replaces the destination while preserving the previous file until replacement succeeds.
6. The UI receives the updated timestamp and hash and displays **Saved**.

The core vertical slice treats Open Merchant as the sole writer while a project is open and documents that limitation. After the vertical slice is reliable, external-file conflict detection may record each loaded source-data hash and stop a save when the on-disk hash changes. The user is then offered **Reload project**; V0 never attempts a merge.

Generated artifacts are always rebuilt from parsed source data. The application never reads previously generated calculation columns as trusted inputs.

## 10. Error Handling

Errors use user-facing messages with actionable detail and a technical detail disclosure where helpful.

- **Not a project:** explain that a valid `merchant-project.json` was not found.
- **Unsupported newer schema:** show the project schema and supported schema; do not modify files.
- **Malformed file:** name the relative file and field or row; do not silently repair or overwrite it.
- **Validation failure:** keep the editor open, mark the invalid fields, and do not generate derived artifacts.
- **Save failure:** retain dirty in-memory data, show the destination, and offer retry.
- **External modification, hardening phase:** when conflict detection is enabled, stop the write and offer a full reload.
- **Missing generated artifact:** show it as not generated and offer the appropriate generation action.
- **Failed generation:** append a failed run unless the run journal itself is unavailable, preserve the previous successful artifact, and show a safe error summary without a stack trace, secret values, or paths outside the selected project.
- **Missing recent project:** mark the shortcut unavailable without treating it as data loss.

The app never replaces a valid generated report with an incomplete one. Generation writes and validates the new artifact before replacement.

## 11. Security and Local-First Boundary

- The bundled UI loads only local application assets; remote pages are never rendered inside the privileged webview.
- Tauri capabilities expose only the commands required by the main window.
- Workspace operations resolve controlled relative paths beneath the selected project root and reject traversal outside it.
- Artifact viewing is restricted to known workspace files and supported text formats.
- Source links are limited to `http` and `https` and open in the system browser.
- No secrets, credentials, network services, or telemetry exist in V0.
- Recent-project paths are the only project-related data stored outside the project folder. On Windows they are stored in the application's roaming-data directory as `Open Merchant/recent-projects.json`.

## 12. Testing Strategy

### 12.1 Core Unit Tests

- Every unit-economics formula
- Decimal rounding boundaries
- Zero and invalid selling prices
- Negative-profit scenarios
- Fee rates at 0 and 100
- Competitor minimum and maximum
- Average and odd/even median
- Missing-price and empty-set behavior
- Currency and validation rules

### 12.2 Workspace Integration Tests

Using temporary directories:

- Create the complete project layout
- Save and reopen a representative project
- Preserve commas, quotes, Unicode, and newlines in CSV fields
- Parse and rewrite JSONL records
- Reject malformed and newer-schema projects without modification
- Append valid run and provenance records
- Verify recorded SHA-256 hashes

After the vertical slice passes, hardening tests cover external-change detection and recovery of the prior artifact from interrupted or failed generation.

### 12.3 Report Tests

- Generate all required sections in a stable order
- Use current competitor statistics and economics outputs
- Render explicit empty-section text instead of invented narrative
- Resolve source IDs into the evidence index
- Include the generating run ID
- Produce stable Markdown for fixed non-time inputs after timestamps and IDs are supplied by the test

### 12.4 Frontend Tests

- Project snapshot renders into the six workspace sections
- Invalid fields show actionable feedback
- Save status transitions correctly
- Economics preview distinguishes editable inputs from calculated outputs
- Out-of-date scenario and report states are visible
- Artifact tree selection loads viewer content

Desktop end-to-end automation is not required for V0. A documented manual smoke test covers create, edit, generate, close, reopen, artifact inspection, and installer launch.

## 13. Build and Public Showcase

The core delivery gate requires a successful local Windows production build and launch smoke test. The basic unsigned NSIS package must install and launch on Windows 11; branding, signing, and release automation are not blockers.

After the vertical slice passes locally, Windows CI is added to perform:

- Frontend formatting, type checking, tests, and production build
- Rust formatting check, linting, and tests
- Tauri production build on the main branch and release tags

The README warns that Windows may display a reputation warning for an unsigned prototype.

The repository includes:

- AGPL-3.0-only license
- Architecture and workspace-format overview
- Windows prerequisites and development commands
- Test and build commands
- Current limitations and explicit non-goals
- Example project under `examples/mechanical-keyboards-india`
- Three screenshots: research workspace, economics scenarios, and report/artifact viewer
- A 30–60 second demo script

## 14. Acceptance Criteria

The first public Windows prototype is complete when all of the following are true:

1. A user can create a project in a chosen folder, close the app, reopen the project, and recover its saved state.
2. The user can edit the objective, evidence, competitors, costs, and three selling-price scenarios through the desktop UI.
3. Competitor statistics and unit economics match the documented formulas and automated tests.
4. The user can generate an evidence-linked Markdown opportunity report from current saved inputs.
5. The project folder contains readable CSV, JSON, JSONL, and Markdown artifacts in the documented structure.
6. Basic run and provenance records identify the generation operation, time, referenced sources, inputs, outputs, and output hashes.
7. The user can inspect known files in the app and open the project folder in Explorer.
8. Important domain, workspace round-trip, and report-generation tests pass locally.
9. A Windows production build and basic unsigned NSIS package launch successfully on Windows 11.
10. A complete example project, useful README, three screenshots, and a 30–60 second demo-ready workflow are present.

External-file conflict detection, rich provenance browsing, extra integrity checks, advanced recovery, CI/release polish, and secondary UX refinement are explicitly non-blocking for this acceptance gate.

## 15. Approved Design Decisions

- Use Tauri 2, React, TypeScript, Vite, and Rust.
- Keep the canonical project state in normal files; do not use SQLite in V0.
- Keep commerce calculations in a pure Rust core.
- Use one project currency and decimal strings at file boundaries.
- Support shared costs and exactly three selling-price scenarios.
- Generate the report deterministically from saved data and user-authored narrative.
- Track only meaningful generation operations, not every edit.
- If hardening time remains, detect external edits and reload rather than attempting a merge.
- Ship Windows only with an unsigned NSIS prototype installer.
- Defer AI and all online research integrations until after the artifact-first workflow is proven.
- Treat the ordered user-facing vertical slice as the public-prototype gate; perform hardening only after that gate works reliably.
