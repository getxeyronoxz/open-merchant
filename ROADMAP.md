Open Merchant is built in the open. This file states what has shipped, what is being worked on, and the direction of the product — updated as reality changes, not as promises. Ground rules that never change: local-first (user-owned project folders), no cloud sync, no accounts, no telemetry, no payments, no autonomous browsing, and commerce math that never touches floating point or an LLM.

## ✅ Shipped — V1.0.0-alpha (2026-08)

* Full rebuild on a TypeScript pnpm monorepo: Electron desktop app, domain engine, AI layer, typed SDK, shared zod contracts, design system.
* Deterministic core with golden parity: arbitrary-precision decimals, half-away-from-zero rounding at emission only, competitor statistics, evidence-linked report renderer — outputs pinned by golden fixtures.
* Workspace format v2: `.openmerchant/` manifest, JSON/JSONL artifacts, atomic replace-on-success writes, known-layout path guard, run and provenance journals. One-time V0 → V2 importer.
* Six AI assistants (planner, evidence, competitor analyst, economics reviewer, report writer, auditor) producing zod-validated drafts with human acceptance; bring-your-own Anthropic/OpenAI key sealed with OS-backed storage; provenance records agent, provider, model, prompt hash.
* Rebuilt UI ("The Merchant's Ledger" design system): TanStack Query data layer, coded error states with retry, ledger-style statistic rows, generated reports rendered as paper documents.
* Verification: 77 unit/integration tests, service-level integration suite, Electron end-to-end smoke; CI on Windows/macOS/Linux.
* Cross-platform installers (NSIS / DMG / AppImage) via electron-builder.

## 🔄 In progress — near term

* Signed installers + auto-update — code-signing certificates for Windows (and notarization for macOS), then delta auto-updates. Done when: a fresh install on each platform shows no "unsigned/unknown publisher" warning, and an update installs without a manual re-download.
* Onboarding — first-run walkthrough of the six-section workflow. Done when: a first-time user reaches their first generated report without external help or documentation.
* More providers — Google Gemini and OpenAI-compatible local endpoints (Ollama, LM Studio) behind the existing BYO-key provider registry. Done when: at least one local-endpoint provider passes the same provider test suite as Anthropic/OpenAI today.
* Richer artifact viewer — side-by-side diffs of regenerated reports and scenario runs, filtered provenance search. Done when: a user can answer "what changed since last time" without opening the raw JSONL files.
* Visibility — README demo asset (short GIF of the real evidence → report loop), and a first build-in-public thread once the demo exists. Done when: the README shows the product working, not just describing it.

## 🧭 Phase 2 — the commerce-ops cockpit
Entry criteria: V1.0.0 is out of alpha and stable, and at least a handful of real (non-demo-project) users have generated reports with it. Phase 2 does not start on a timeline — it starts when that's true.
Launch decision: Product Hunt launch is planned for Phase 2, not before — once onboarding, the demo asset, and V1.0.0 stability are all in place.
The research-to-decision core becomes a living cockpit for sellers who have already decided:

* Market snapshots — save timestamped competitor captures; price-history per listing and per market.
* Margin monitoring — watch assumptions against recorded market prices; flag when a scenario's margin drifts past your threshold.
* Decision journal — compare today's report against the one you generated a month ago; what changed, what evidence is stale.
* Portfolio view — track multiple projects (products) in one place.

## 🌌 Exploratory (not committed)

* MCP-style connectors for read-only market data the user opts into — must preserve the "no autonomous browsing" ground rule: the user triggers each fetch explicitly, nothing crawls or polls on its own.
* Plugin surface for custom report sections and importers.
* Team-readable exports (still file-based, still no cloud).

Priorities may reorder; the ground rules above may not change. Feature requests: open an issue describing the decision you are trying to make.
