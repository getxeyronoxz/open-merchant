# Changelog

All notable changes to Open Merchant are documented in this file.

## [Unreleased]

### Added
- Workspace orientation: the toolbar now shows a project / section breadcrumb alongside the ellipsized folder path, so you always know where you are and where the files live.
- Alt+1…8 section shortcuts jump between the six workspace sections, Draft Desk, and AI settings without reaching for the mouse; the rail shows the numbers and nav buttons expose `aria-keyshortcuts` for accessibility hosts. Shortcuts are ignored while typing.
- Draft Desk: one visible triage lane for the six existing assistants. Evidence, competitor, and report-section drafts are editable and require explicit Accept/Discard; research plans, economics reviews, and report audits are review-only. Provenance (agent, provider, model, prompt hash) is visible before any acceptance.
- README: a "Getting around" section (breadcrumb, shortcuts, walkthrough guide), a note on how the demo GIF is produced, and a Star History chart.

### Changed
- Haptic UI pass across the app: all four button variants lift on hover and sink on press (polish now owned by the `@open-merchant/ui` design system), and every clickable ledger surface — nav rail, recent-project cards, walkthrough steps, provider tiles, history rows, artifact rows, diff tabs — answers the pointer with consistent press feedback.
- Demo recorder v2 (`record.cjs`): captures motion frames during typing, scrolling, hovering, and panel transitions (select-all before typing so pre-filled money fields pass `pattern` validation, and waiting for the assumptions-saved badge before Calculate); `gif.mjs` holds motion frames 90ms and keyframes longer, so the regenerated `docs/media/demo-loop.gif` reads like a screen recording.
- ROADMAP Phase 3 rewritten as the connected-workbench plan (MCP server mode, triage inbox, MCP connector client, standing reviews, plugin surface, currency change, interchange spec), gated on the draft-gate principle, with the competitive research note in `docs/research/phase-3-connected-workbench.md`.
- Docs & repo hygiene: architecture verification map gains the real-app Electron E2E row; owner-only authorship and dependency-alert triage policy documented; local agent scratch output (`.agent/`) ignored.

### Security
- `extract-zip` patched against CVE-2026-19693 (GHSA-7pqw-9j4j-h8q3): pinned the upstream containment fix through `pnpm.patchedDependencies` so writes through a symlink at the entry's final path component are refused. Build-time-only dependency of the Electron install script; never shipped in installers.

### Fixed
- Electron end-to-end suite: vitest `hookTimeout` raised to 60s — cold CI runners exceeded the 10s default launching Electron under xvfb even though every test passed.

## [1.0.0-alpha.4] - 2026-09-17

### Added
- Phase 2 cockpit: market snapshots (immutable timestamped captures with per-listing price history and snapshot diffs), margin monitoring (per-project threshold with market-drift flags), decision journal (any-two report comparison plus stale-evidence flags), and a portfolio overview (every project on one screen, worst-margin first).
- File-first pillar: CSV export for competitors, evidence, and scenarios; validated CSV import with auto-detected column mapping and per-row error reporting; portable single-file `.omarchive` project backups; and print-perfect PDF export of the generated report.
- Linux universal packages: snap and flatpak targets join AppImage in the release workflow.
- AI assistants: stronger shared system prompts — groundedness, honesty about gaps, analyst-grade tone, and strict JSON discipline.

### Changed
- Home screen redesign: the recents panel now leads with a full-width "New workspace" call-to-action above a ruled divider of recent decisions (with a count badge), the hero gains a quiet trust strip (no accounts / no cloud sync / no telemetry), the portfolio card spans its full row instead of stranding in a half-empty grid column, recent listings get lift-and-glow hover with a sliding arrow, and buttons gain ledger-style inset highlights with consistent press feedback.
- Home screen gains the portfolio overview table; new panels carry explicit empty-state guidance.
- Windows builds use an integrated title-bar overlay in the Ledger palette; the top chrome drags the window and every control inside stays clickable.
- AI settings: connection-test failures surface as `ai-provider-error` with human-readable provider messages (key rejected / unknown model / rate limit / temporary overload) instead of raw provider JSON mislabeled as `storage-error`.
- AI settings: default model IDs refreshed to current provider lineups (Anthropic `claude-sonnet-5`, OpenAI `gpt-5.6-terra`, Gemini `gemini-3.8-flash`, local `qwen3.5:9b`); the Competitors snapshot card and decision-journal report pickers get their intended two-column layout with proper spacing.
- AI providers: transient failures (HTTP 429/5xx — load spikes and rate limits) are retried automatically with short backoff, honoring the provider's `Retry-After` when sent; permanent failures (rejected key, unknown model) fail immediately. A Gemini 503 "high demand" spike now usually recovers without a manual retry.
- Report: generation stays disabled with a "set your selling prices first" guide (and a jump to Economics) until all three scenario prices exist — the missing-prices error is now prevented, not just reported. When generation still fails on invalid input (e.g. prices removed after the fact), the error offers "Open Economics" to fix the cause instead of a retry that would fail identically; transient failures keep their retry button.
- CI: the Electron end-to-end suite runs on every push to `dev`; the release workflow is hardened with a concurrency guard against racing publishes, a job timeout, an Electron-binary cache, and a least-privilege checkout.

### Security
- Fixed all open Dependabot and CodeQL alerts ahead of launch: vitest upgraded 3.2.7 → 4.1.11 across every package (path-traversal via `@vitest/mocker` redirect mock, CVE-2026-84373), `js-yaml` pinned to the patched 4.3.2 via a pnpm override (merge-keys CPU exhaustion, CVE-2026-84375), and the local-endpoint URL trim in the AI provider layer rewritten without a polynomial regular expression (CodeQL #4).
- Snap packages now build under a valid explicit name (`open-merchant`) instead of deriving one from the scoped package name, which made `mksquashfs` fail on release runs.
- Known, documented exception: `extract-zip` 2.0.1 (CVE-2026-56876, symlink path traversal) has no patched release. It is a dev-only transitive dependency of the `electron` package used solely to unzip the official Electron distribution on developer machines — it is never shipped in installers and never processes user-supplied archives. The alert is dismissed with reason `no_fix_planned` until upstream publishes a fix.

### Fixed
- Binary-safe `.omarchive` download: archives downloaded from Files & history were decoded through UTF-8 text (corrupting every byte ≥ 0x80) and could not be restored; they now download as raw bytes.
- CSV import now imports the `notes` column instead of silently dropping it — competitor notes round-trip through the file-first pillar (found by new boundary tests).
- Recent-projects list is capped at the 20 most recent workspaces (it previously grew unbounded and every entry renders on Home), and a malformed recents file is quarantined beside the fresh list instead of being silently destroyed.
- Snap packaging: an invalid snap option was dropped so local `dist` builds (and the snap target) run cleanly.

## [1.0.0-alpha.3] - 2026-09-03

### Added

- Custom application menu: a purpose-built menu replaces the default Electron menu, matched to the app's structure and actions.
- In-app update banner: update notices now appear inside the app as a dismissible banner instead of a native dialog, carried over the validated IPC contract (new shared schemas, typed SDK methods, and in-memory mock coverage).
- Scripted demo recorder: `record.cjs` drives a real build through the evidence → competitors → economics → report loop with Playwright and `gif.mjs` assembles the frames with gifenc (pure JS, no ffmpeg) — no AI keys, no network — producing the `docs/media/demo-loop.gif` now embedded in the README.
- Build-in-public thread draft (`docs/marketing/build-in-public-thread.md`) and an onboarding validation kit (`docs/onboarding-validation-kit.md`) for the first unaided-user check.
- Release workflow signature checks: the release CI verifies artifact signatures before publishing.

### Changed

- The renderer client only probes `window.openMerchant` when a `window` exists, so the module imports safely outside a browser context; behavior inside Electron and the dev-server mock is unchanged.

## [1.0.0-alpha.2] - 2026-08-30

### Added

- Richer artifact viewer: the Artifacts tab now answers "what changed since last time" without opening raw files — a side-by-side diff of the latest generated report against the previous generation (LCS line alignment, removed/added highlighting, equal-height paired columns), plus filtered provenance search over the run journal by agent, provider, model, and text.
- Run history surface: the deterministic core records a per-workspace generation history; the typed SDK, in-memory mock, and main-process service expose it over the validated IPC contract. Covered by new core unit tests, a service-level integration test, mock-client tests, a diff unit suite, and the Electron e2e.

## [1.0.0-alpha.1] - 2026-08-28

### Added

- Onboarding: one-time first-run welcome card on an empty Home (create → feed → decide), a standing invitation after dismissal, an "AI assistants are optional" tip inside the walkthrough guide, and reopen targeting that lands mid-walkthrough projects on their first incomplete step. Renderer-only; unit and e2e covered.
- More providers: Google Gemini and local OpenAI-compatible endpoints (Ollama, LM Studio) behind the BYO-key registry. Local endpoints need only a base URL — no key, no cloud. A shared HTTP provider contract suite runs identically across all four providers.
- Auto-update: `electron-updater` performs a passive check against the project's own GitHub Releases feed; delta downloads with restart-or-quit install. A `v*` tag pushes build and publish NSIS/DMG/AppImage to Releases from GitHub runners. Local device testing supported via `OPEN_MERCHANT_TEST_UPDATE_URL` and a self-signed developer certificate (`dev-signing.ps1`, alias-only identity).
- App icon: the Merchant's Ledger mark (brass serif M, ledger leaders, accent coin) across window, taskbar, and installers.

### Changed

- UI quality pass: layered card depth, glowing input focus, table row hover, accent-dot empty states, dual-glow canvas, gradient brass hero, hover motion on recents, and a styled four-card AI provider picker.
- Electron upgraded 37.10.3 → 39.8.10, clearing 63 Dependabot advisories in the shipped runtime.
- CI verifies every push to `dev` on Windows/macOS/Linux and fixes the pnpm version conflict that had silently broken the verify job.

### Security

- All open Dependabot alerts (64, including context-isolation bypasses and sandbox escapes) and all code-scanning warnings resolved; secret scanning clean.

## [1.0.0-alpha.0] - 2026-08-26

### Changed

- Complete rebuild on a TypeScript pnpm monorepo: Electron desktop app with packages for the shared IPC contract, domain engine, AI agents, typed SDK, and design system. The legacy Tauri/Rust implementation is retired; its deterministic semantics survive through golden parity tests.
- New workspace format v2: `.openmerchant/manifest.json` plus JSON/JSONL artifacts, atomic replace-on-success writes, known-layout path guards, and run/provenance journals that record agent id, provider, model, prompt hash, and artifact fingerprints for accepted AI drafts.
- Six specialist AI assistants (research planner, evidence assistant, competitor analyst, economics reviewer, report writer, auditor) produce zod-validated drafts the user must accept; bring-your-own Anthropic or OpenAI key, sealed with OS-backed storage.
- Rebuilt UI on a new dark-first design system ("The Merchant's Ledger") with TanStack Query, coded error states with retry, ledger-style statistics rows, and generated reports rendered as paper documents.
- Deterministic commerce math preserved exactly: arbitrary-precision decimals, half-away-from-zero rounding at emission only; outputs pinned by golden fixtures.
- One-time V0 -> V2 project import replaces direct opening of legacy folders.

### Removed

- Legacy planning documents under `docs/superpowers/` and the superseded manual smoke/demo guides.

## [0.1.0] - 2026-08-08

### Added

- Windows-first Tauri desktop workspace for local commerce/product research.
- Create, open, and reopen user-owned project folders.
- Research objectives, evidence records, competitor comparison, deterministic price statistics, and fixed-decimal unit economics.
- Markdown opportunity reports, artifact inspection, run history, and SHA-256 provenance records.
- Mechanical Keyboards India example project and demo workflow documentation.
- Windows NSIS bundle configuration, frontend/Rust test suites, and CodeQL analysis.

### Fixed

- Restored persisted economics scenarios when reopening a project.
- Hidden the Windows console window for production desktop builds.

### Security

- Licensed Open Merchant under `AGPL-3.0-only` and added a security reporting policy.
