# Contributing to Open Merchant

Thanks for helping improve Open Merchant. Please keep contributions focused on the local-first, artifact-first V0 workflow.

## Local setup

On Windows 11, install Node.js 22+ with npm and Rust stable with the MSVC toolchain. Then run:

```powershell
npm ci
npm run tauri dev
```

Before opening a pull request, run:

```powershell
npm run test:run
npm run build
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --all-targets --all-features
```

## Pull requests

- Start from the current `main` branch and use a focused branch name.
- Keep commits and pull requests small, clear, and independently reviewable.
- Add or update focused tests for changed behavior. Diagnose failures before changing code.
- Open an issue first for a substantial change or a change that could affect V0 scope, project-file compatibility, licensing, security, or user data ownership.
- Do not add cloud services, accounts, AI/chat, scraping, marketplace integrations, payments, mobile, or other V1 scope without founder approval.

Report security vulnerabilities through [SECURITY.md](SECURITY.md), not public issues. By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Open Merchant is licensed under `AGPL-3.0-only`. No contributor license agreement, DCO, or copyright assignment is required for ordinary contributions.
