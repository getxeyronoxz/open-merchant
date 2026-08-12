# Contributing to Open Merchant

Thanks for helping improve Open Merchant. Keep contributions focused on the local-first, artifact-first V0 workflow described in [README.md](README.md) and [docs/architecture.md](docs/architecture.md).

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

For a Windows package or app-icon change, also run:

```powershell
npm run tauri build -- --bundles nsis
```

## Documentation and application identity

- Update `README.md` when user-visible workflow, requirements, workspace files, or limitations change.
- Keep [docs/architecture.md](docs/architecture.md), [manual smoke testing](docs/manual-smoke-test.md), and the [demo script](docs/demo-script.md) aligned with the shipped app.
- `docs/superpowers/` preserves historical plans and specifications. Do not update it to describe current behavior; update the current documents above instead.
- Edit `src-tauri/app-icon.svg` for application-logo changes, then regenerate the committed bundle icon set with `npm run tauri -- icon src-tauri/app-icon.svg --output src-tauri/icons`.

## Pull requests

- Start from the current `main` branch and use a focused branch name.
- Keep commits and pull requests small, clear, and independently reviewable.
- Add or update focused tests for changed behavior. Diagnose failures before changing code.
- Open an issue first for a substantial change or a change that could affect V0 scope, project-file compatibility, licensing, security, or user data ownership.
- Do not add cloud services, accounts, AI/chat, scraping, marketplace integrations, payments, mobile, or other V1 scope without founder approval.
- For UI changes, verify keyboard focus, content order, and reduced-motion behavior in addition to automated tests.

Report security vulnerabilities through [SECURITY.md](SECURITY.md), not public issues. By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Open Merchant is licensed under `AGPL-3.0-only`. No contributor license agreement, DCO, or copyright assignment is required for ordinary contributions.
