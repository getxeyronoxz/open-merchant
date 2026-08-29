Open Merchant is built in the open. This file states what has shipped, what is being worked on, and the direction of the product — updated as reality changes, not as promises. Ground rules that never change: local-first (user-owned project folders), no cloud sync, no accounts, no telemetry, no payments, no autonomous browsing, and commerce math that never touches floating point or an LLM.

## ✅ Shipped — V1.0.0-alpha (2026-08)

* Full rebuild on a TypeScript pnpm monorepo: Electron desktop app, domain engine, AI layer, typed SDK, shared zod contracts, design system.
* Deterministic core with golden parity: arbitrary-precision decimals, half-away-from-zero rounding at emission only, competitor statistics, evidence-linked report renderer — outputs pinned by golden fixtures.
* Workspace format v2: `.openmerchant/` manifest, JSON/JSONL artifacts, atomic replace-on-success writes, known-layout path guard, run and provenance journals. One-time V0 → V2 importer.
* Six AI assistants (planner, evidence, competitor analyst, economics reviewer, report writer, auditor) producing zod-validated drafts with human acceptance; bring-your-own Anthropic/OpenAI key sealed with OS-backed storage; provenance records agent, provider, model, prompt hash.
* Rebuilt UI ("The Merchant's Ledger" design system): TanStack Query data layer, coded error states with retry, ledger-style statistic rows, generated reports rendered as paper documents.
* Verification: 112 unit/integration tests, service-level integration suite, Electron end-to-end smoke driving the real IPC stack; CI matrix on Windows/macOS/Linux for every push to `dev`.
* Cross-platform installers (NSIS / DMG / AppImage) via electron-builder.
* Onboarding: one-time Home welcome card, persistent six-step walkthrough guide with an "AI assistants are optional" tip, chained next-step actions on every screen, and reopen targeting onto the next incomplete step — covered by unit tests and Electron e2e.
* More providers: Google Gemini and local OpenAI-compatible endpoints (Ollama, LM Studio) behind the BYO-key registry — local endpoints are keyless (base URL only, stays on the user's machine), and all four providers pass the same HTTP contract test suite.
* Auto-update pipeline: `electron-updater` passively checks the project's own GitHub Releases (delta downloads, restart-or-quit install); a `v*` tag publishes NSIS/DMG/AppImage from GitHub runners. A self-signed developer certificate (`dev-signing.ps1`, alias-only identity) signs local builds — a trusted CA certificate can replace it later with zero code changes.
* Application icon (the Merchant's Ledger mark) and a screenshot-verified UI quality pass: layered depth, glowing focus, hover states, motion.
* Security baseline: Electron 39.8.10, zero open Dependabot / code-scanning / secret-scanning alerts, and a three-OS verify matrix on every push to `dev`.

## 🔄 In progress — near term

* Signed installers — replace the self-signed developer certificate with a CA-issued one (or the same pfx distributed via repo secrets) so fresh installs on unknown machines show a verified publisher. Done when: a fresh install on each platform shows no "unsigned/unknown publisher" warning. First tagged release run: Windows published the installer + update feed; macOS/Linux packaging fixes are in, their assets land on the next tag.
* Richer artifact viewer — side-by-side diffs of regenerated reports and scenario runs, filtered provenance search. Done when: a user can answer "what changed since last time" without opening the raw JSONL files.
* Visibility — README demo asset (short GIF of the real evidence → report loop), and a first build-in-public thread once the demo exists. Done when: the README shows the product working, not just describing it.
* Onboarding validation — one qualitative check with a genuinely new user reaching their first generated report unaided (no instrumentation, per ground rules).

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
