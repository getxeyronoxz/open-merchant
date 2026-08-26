# Contributing to Open Merchant

Thanks for helping improve Open Merchant. Keep contributions focused on the
local-first, artifact-first workflow described in [README.md](README.md) and
[docs/architecture.md](docs/architecture.md).

## Local setup

Install Node.js 22+ and pnpm 9+, then run:

```bash
pnpm install
pnpm dev
```

The desktop app opens in development mode; the renderer also runs standalone
at the printed local URL with an in-memory mock client.

## Before opening a pull request

```bash
pnpm -r test && pnpm lint && pnpm typecheck
```

Electron end-to-end tests live separately from the unit suites:

```bash
pnpm --filter @open-merchant/desktop test:e2e
```

For packaging changes, build the installers for your platform:

```bash
pnpm --filter @open-merchant/desktop dist
```

## Documentation

- Update `README.md` when user-visible workflow, requirements, workspace
  files, or limitations change.
- Keep [docs/architecture.md](docs/architecture.md) aligned with shipped
  behavior.

## Pull requests

- Start from the current `dev` branch and use a focused branch name
  (`feature/*`). `main` holds the archived V0 codebase and stays frozen.
- Keep commits and pull requests small, clear, and independently reviewable.
- Add or update focused tests for changed behavior. Diagnose failures before
  changing code.
- Commerce math must stay exact: arbitrary-precision decimals only, computed
  in `packages/core`. Never introduce binary floating point or LLM calls into
  calculations.
- AI assistants may only produce validated drafts that a human accepts;
  accepted content journals provenance (agent id, provider, model, prompt
  hash). Never send API keys through IPC responses, logs, project folders, or
  tests.
- Do not add cloud sync, accounts, teams, telemetry, payments, autonomous
  browsing, or marketplace integrations without owner approval.
- For UI changes, verify keyboard focus, content order, and reduced-motion
  behavior in addition to automated tests.

Report security vulnerabilities through [SECURITY.md](SECURITY.md), not
public issues. By participating, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

Open Merchant is licensed under `AGPL-3.0-only`. No contributor license
agreement, DCO, or copyright assignment is required for ordinary
contributions.
