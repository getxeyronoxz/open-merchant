# Changelog

All notable changes to Open Merchant are documented in this file.

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

### Changed

- Modernized the focused home screen and six-section desktop workspace while preserving the local-first V0 workflow.
- Refreshed the canonical Open Merchant application icon and all bundled Windows icon variants with the graphite-and-lime palette.
- Connected the README, architecture reference, agent guide, contributor guide, manual smoke test, and demo guidance to the shipped V0 behavior.

### Fixed

- Use crash-safe replacement when saving workspace artifacts and the local recent-project list.
- Preserve interrupted report generations in local run history, including any artifacts saved before the interruption, and show recovery guidance in the History tab.
- Added visible keyboard focus treatment and polite save-status announcements for updated form state.

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
