# Changelog

All notable changes to Open Merchant are documented in this file.

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
