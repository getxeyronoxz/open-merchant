Open Merchant is built in the open. This file states what has shipped, what is being worked on, and the direction of the product — updated as reality changes, not as promises. Ground rules that never change: local-first (user-owned project folders), no cloud sync, no accounts, no telemetry, no payments, no autonomous browsing, and commerce math that never touches floating point or an LLM.

## ✅ Shipped — V1.0.0-alpha (2026-08 → 09)

* Full rebuild on a TypeScript pnpm monorepo: Electron desktop app, domain engine, AI layer, typed SDK, shared zod contracts, design system.
* Deterministic core with golden parity: arbitrary-precision decimals, half-away-from-zero rounding at emission only, competitor statistics, evidence-linked report renderer — outputs pinned by golden fixtures.
* Workspace format v2: `.openmerchant/` manifest, JSON/JSONL artifacts, atomic replace-on-success writes, known-layout path guard, run and provenance journals. One-time V0 → V2 importer.
* Six AI assistants (planner, evidence, competitor analyst, economics reviewer, report writer, auditor) producing zod-validated drafts with human acceptance; bring-your-own Anthropic/OpenAI key sealed with OS-backed storage; provenance records agent, provider, model, prompt hash.
* Rebuilt UI ("The Merchant's Ledger" design system): TanStack Query data layer, coded error states with retry, ledger-style statistic rows, generated reports rendered as paper documents.
* Verification: 132 unit/integration tests, service-level integration suite, Electron end-to-end smoke driving the real IPC stack; CI matrix on Windows/macOS/Linux for every push to `dev`.
* Cross-platform installers (NSIS / DMG / AppImage) via electron-builder.
* Richer artifact viewer: the Artifacts tab shows a side-by-side diff of the latest report against the previous generation and a filtered provenance search — "what changed since last time" without opening raw JSONL files (shipped in `1.0.0-alpha.2`).
* Onboarding: one-time Home welcome card, persistent six-step walkthrough guide with an "AI assistants are optional" tip, chained next-step actions on every screen, and reopen targeting onto the next incomplete step — covered by unit tests and Electron e2e.
* More providers: Google Gemini and local OpenAI-compatible endpoints (Ollama, LM Studio) behind the BYO-key registry — local endpoints are keyless (base URL only, stays on the user's machine), and all four providers pass the same HTTP contract test suite.
* Auto-update pipeline: `electron-updater` passively checks the project's own GitHub Releases (delta downloads, restart-or-quit install); a `v*` tag publishes NSIS/DMG/AppImage from GitHub runners. A self-signed developer certificate (`dev-signing.ps1`, alias-only identity) signs local builds — a trusted CA certificate can replace it later with zero code changes.
* Application icon (the Merchant's Ledger mark) and a screenshot-verified UI quality pass: layered depth, glowing focus, hover states, motion.
* README demo loop: the real evidence → economics → report flow recorded as a scripted, deterministic GIF (`docs/media/demo-loop.gif`, no AI keys, no network) — the README shows the product working, not just describing it.
* Alpha-3 shell: a purpose-built custom application menu and an in-app update banner replacing the native update dialog, carried over the same validated IPC contract (shipped in `1.0.0-alpha.3`).
* Sharper demo loop: the README GIF re-rendered at 960px with box-filter downscaling, an rgb565 palette, and a smooth report scroll — same deterministic recorder, visibly better frames.
* Launch announced: the build-in-public posts went out on X and Threads with the demo loop (2026-09-03); the long-form thread draft lives at `docs/marketing/build-in-public-thread.md`.
* Security baseline: Electron 39.8.10, zero open Dependabot / code-scanning / secret-scanning alerts, and a three-OS verify matrix on every push to `dev`.

## 🔄 In progress — near term

* Signed installers — replace the self-signed developer certificate with a CA-issued one so fresh installs on unknown machines show a verified publisher. Done when: a fresh install on each platform shows no "unsigned/unknown publisher" warning. The first tagged build is live: `v1.0.0-alpha.1` publishes Windows, macOS, and Linux installers plus the full update feed (latest.yml / latest-mac.yml / latest-linux.yml) from GitHub Releases, with locally-verified delta updates. Note: distributing the self-signed pfx via repo secrets signs builds but cannot remove the warning on machines that don't trust it — only the CA certificate can. Windows "unknown publisher" disappears with OV signing; SmartScreen may still ask for confirmation until download reputation builds.
* Onboarding validation — one qualitative check with a genuinely new user reaching their first generated report unaided (no instrumentation, per ground rules).

## 🧭 Phase 2 — the commerce-ops cockpit
Entry criteria: V1.0.0 stable and a handful of real users — replaced by an owner decision on 2026-09-03: Phase 2 implementation begins alongside the alpha line, because the cockpit features are what alpha users need next.
Planning status: **Phase 2 implementation has started (2026-09-05).** The features below are the committed scope, each with a done-when.
Launch decision: the Product Hunt launch happens during Phase 2, once the cockpit features land — a complete, opinionated product before a bigger audience. The pitch for that day is written here so the roadmap and the storefront say the same thing: **real desktop software for people who miss real software — your files, exact math, and AI that drafts and waits.** AI in Open Merchant is a drafting pen, never an operator: assistants extend what one person can produce, but nothing browses, decides, or acts on its own.

The research-to-decision core becomes a standing tool the seller keeps open after the decision — a cockpit, not a one-shot wizard. What sellers already expect from the price-history tools they pay for (per-listing history lines, min/max/average over a window, drop alerts), rebuilt local-first:

* Market snapshots — capture a timestamped, immutable competitor listing set into the workspace in one action. Per-listing and per-market price history lines build up as snapshots accumulate; the ledger shows min, max, average, and median over any window, and a snapshot diff shows exactly which listing moved and by how much. Done when: a seller can answer "what did this listing cost when I first looked?" without leaving the app.
* Margin monitoring — scenarios recompute against the latest snapshot; when a market price drifts past the seller's threshold, the Economics screen and the portfolio flag it locally — no servers, no push, no polling. Done when: a changed market price is visible in the app before the seller goes looking for it.
* Decision journal — every report generation is a dated entry; the journal lines up reports side by side (building on the alpha.2 diff viewer), highlights evidence that has gone stale, and answers "would I still make this decision today?". Done when: a seller can compare today's report against last month's in under a minute.
* Portfolio view — every project on one screen: decision status, latest margin per scenario, age of the last snapshot, open flags — so a seller with five projects sees which one needs attention first. Done when: the portfolio answers "what needs attention today?" in one glance.

And a pillar for the people who chose desktop software on purpose — the file-first, unglamorous work that subscription SaaS forgot:

* Portable project folders — archive a workspace to a single versioned file and restore it anywhere; old archives keep opening. Done when: an archive made on Windows opens identically on macOS and Linux.
* Spreadsheet bridges — CSV import with column mapping and row-level validation (bad rows rejected with reasons, never silently "fixed" — supplier data is dirty and the seller must see why), and CSV export for competitors, evidence, scenarios, and snapshots. Done when: a supplier spreadsheet becomes a competitor table in under two minutes, and any table in the app can be exported back out — without a single byte leaving the machine.
* Print-perfect output — a dedicated print stylesheet and Chromium print-to-PDF, so the generated report prints and PDFs exactly as it appears on screen, header to footer, because "send me the document" is still how business is done. Done when: the printed report is indistinguishable from the app's paper document.

Phase 2 changes what the tool does; the ground rules never move: local-first, no accounts, no telemetry, no autonomous agents, and math that never touches floating point or an LLM.

## 🛰 Phase 3 — the connected workbench (direction, not started)
Entry criteria: the Phase 2 cockpit is in real use — sellers actually keep snapshots and open the portfolio. Where Phase 2 turns one decision into a standing record, Phase 3 connects the workbench outward, strictly on the user's terms:

* Opt-in market-data connectors — read-only, MCP-style; the user triggers each fetch explicitly, nothing crawls or polls on its own (graduated from Exploratory — the no-autonomous-browsing ground rule binds here harder than anywhere).
* Plugin surface — community report sections and importers, loaded locally and fully inspectable before they run.
* Team-readable exports — hand a colleague the whole decision as files, not accounts; still no cloud.
* Standing reviews — locally scheduled reminders that resurface a stale decision ("you haven't re-checked this market in 30 days"); the timer lives in the app, not on a server.

## 🌌 Exploratory — experiments, not product promises
These are ideas tested in local prototypes and throwaway branches only. Nothing in this section is a feature, a commitment, or an announcement: none of it appears in the shipped software, release notes, or marketing at that time. An idea ships only if it graduates — rewritten as a real entry with entry criteria inside a committed phase first. (The former exploratory items — connectors, plugins, team exports — graduated into Phase 3 above.)

Priorities may reorder; the ground rules above may not change. Feature requests: open an issue describing the decision you are trying to make.
