# Changelog

All notable changes to Open Merchant are documented in this file.

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

## [Unreleased]

### Added

- Custom slim application menu (File/Edit/View/Help) replacing the stock Electron template — Check for Updates… (Ctrl+U), clipboard roles preserved, zoom controls, GitHub link, and an About dialog with the running version.
- Non-blocking in-app update banner: when a new version is downloaded, the renderer offers Restart now / Not now over the validated `update:status` push channel and an `update/install` IPC surface — replacing the native message box. Dismissing keeps working; the update still installs on quit.

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
