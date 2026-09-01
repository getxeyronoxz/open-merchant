Open Merchant is built in the open. This file states what has shipped, what is being worked on, and the direction of the product — updated as reality changes, not as promises. Ground rules that never change: local-first (user-owned project folders), no cloud sync, no accounts, no telemetry, no payments, no autonomous browsing, and commerce math that never touches floating point or an LLM.

## ✅ Shipped — V1.0.0-alpha (2026-08 → 09)

* Full rebuild on a TypeScript pnpm monorepo: Electron desktop app, domain engine, AI layer, typed SDK, shared zod contracts, design system.
* Deterministic core with golden parity: arbitrary-precision decimals, half-away-from-zero rounding at emission only, competitor statistics, evidence-linked report renderer — outputs pinned by golden fixtures.
* Workspace format v2: `.openmerchant/` manifest, JSON/JSONL artifacts, atomic replace-on-success writes, known-layout path guard, run and provenance journals. One-time V0 → V2 importer.
* Six AI assistants (planner, evidence, competitor analyst, economics reviewer, report writer, auditor) producing zod-validated drafts with human acceptance; bring-your-own Anthropic/OpenAI key sealed with OS-backed storage; provenance records agent, provider, model, prompt hash.
* Rebuilt UI ("The Merchant's Ledger" design system): TanStack Query data layer, coded error states with retry, ledger-style statistic rows, generated reports rendered as paper documents.
* Verification: 112 unit/integration tests, service-level integration suite, Electron end-to-end smoke driving the real IPC stack; CI matrix on Windows/macOS/Linux for every push to `dev`.
* Cross-platform installers (NSIS / DMG / AppImage) via electron-builder.
* Richer artifact viewer: the Artifacts tab shows a side-by-side diff of the latest report against the previous generation and a filtered provenance search — "what changed since last time" without opening raw JSONL files (shipped in `1.0.0-alpha.2`).
* Onboarding: one-time Home welcome card, persistent six-step walkthrough guide with an "AI assistants are optional" tip, chained next-step actions on every screen, and reopen targeting onto the next incomplete step — covered by unit tests and Electron e2e.
* More providers: Google Gemini and local OpenAI-compatible endpoints (Ollama, LM Studio) behind the BYO-key registry — local endpoints are keyless (base URL only, stays on the user's machine), and all four providers pass the same HTTP contract test suite.
* Auto-update pipeline: `electron-updater` passively checks the project's own GitHub Releases (delta downloads, restart-or-quit install); a `v*` tag publishes NSIS/DMG/AppImage from GitHub runners. A self-signed developer certificate (`dev-signing.ps1`, alias-only identity) signs local builds — a trusted CA certificate can replace it later with zero code changes.
* Application icon (the Merchant's Ledger mark) and a screenshot-verified UI quality pass: layered depth, glowing focus, hover states, motion.
* README demo loop: the real evidence → economics → report flow recorded as a scripted, deterministic GIF (`docs/media/demo-loop.gif`, no AI keys, no network) — the README shows the product working, not just describing it.
* Alpha-3 shell: a purpose-built custom application menu and an in-app update banner replacing the native update dialog, carried over the same validated IPC contract (shipped in `1.0.0-alpha.3`).
* Security baseline: Electron 39.8.10, zero open Dependabot / code-scanning / secret-scanning alerts, and a three-OS verify matrix on every push to `dev`.

## 🔄 In progress — near term

* Signed installers — replace the self-signed developer certificate with a CA-issued one so fresh installs on unknown machines show a verified publisher. Done when: a fresh install on each platform shows no "unsigned/unknown publisher" warning. The first tagged build is live: `v1.0.0-alpha.1` publishes Windows, macOS, and Linux installers plus the full update feed (latest.yml / latest-mac.yml / latest-linux.yml) from GitHub Releases, with locally-verified delta updates. Note: distributing the self-signed pfx via repo secrets signs builds but cannot remove the warning on machines that don't trust it — only the CA certificate can. Windows "unknown publisher" disappears with OV signing; SmartScreen may still ask for confirmation until download reputation builds.
* Build-in-public thread — the demo GIF exists and the thread is drafted (`docs/marketing/build-in-public-thread.md`); what remains is posting it. Done when: the first build-in-public thread is live.
* Onboarding validation — one qualitative check with a genuinely new user reaching their first generated report unaided (no instrumentation, per ground rules).

## 🧭 Phase 2 — the commerce-ops cockpit
Entry criteria: V1.0.0 is out of alpha and stable, and at least a handful of real (non-demo-project) users have generated reports with it. Phase 2 does not start on a timeline — it starts when that's true.
Planning status: Phase 2 planning has already begun locally (this section is that plan); implementation starts only once the entry criteria above are met, now that `1.0.0-alpha.3` is out.
Launch decision: the Product Hunt launch happens when Phase 2 begins, not before — a complete, opinionated product before a bigger audience, no launch from alpha. The pitch for that day is written here so the roadmap and the storefront say the same thing: **real desktop software for people who miss real software — your files, exact math, and AI that drafts and waits.** AI in Open Merchant is a drafting pen, never an operator: assistants extend what one person can produce, but nothing browses, decides, or acts on its own.

The research-to-decision core becomes a standing tool the seller keeps open after the decision — a cockpit, not a one-shot wizard:

* Market snapshots — save timestamped competitor captures; price history per listing and per market.
* Margin monitoring — watch assumptions against recorded market prices; flag when a scenario's margin drifts past your threshold.
* Decision journal — compare today's report against the one you generated a month ago; what changed, what evidence is stale.
* Portfolio view — track multiple projects (products) in one place.

And a pillar for the people who chose desktop software on purpose — the file-first, unglamorous work that subscription SaaS forgot:

* Portable project folders — archive, back up, and restore a workspace as a single file that opens on any of the three platforms.
* Spreadsheet bridges — CSV import for competitor listings and evidence, CSV export for anything the app holds: the data is the user's, in formats other tools can read.
* Print-perfect output — the generated report prints and exports to PDF exactly as it appears on screen, because "send me the document" is still how business is done.

Phase 2 changes what the tool does; the ground rules never move: local-first, no accounts, no telemetry, no autonomous agents, and math that never touches floating point or an LLM.

## 🌌 Exploratory — experiments, not product promises
These are ideas tested in local prototypes and throwaway branches only. Nothing in this section is a feature, a commitment, or an announcement: none of it appears in the shipped software, release notes, or marketing at that time. An idea ships only if it graduates — rewritten as a real entry with entry criteria inside a committed phase first.

* MCP-style connectors for read-only market data the user opts into — must preserve the "no autonomous browsing" ground rule: the user triggers each fetch explicitly, nothing crawls or polls on its own.
* Plugin surface for custom report sections and importers.
* Team-readable exports (still file-based, still no cloud).

Priorities may reorder; the ground rules above may not change. Feature requests: open an issue describing the decision you are trying to make.
