# CLAUDE.md

Instructions for Claude Code working in this repository.

## Product and scope

- Open Merchant is a local-first, AI-native commerce research workbench. The user-owned project folder is the product.
- TypeScript pnpm monorepo: Electron app in `apps/desktop`; domain, AI, SDK, UI, and shared schemas in `packages/*`.
- Commerce math runs only on arbitrary-precision decimals in `packages/core`. Never use binary floating point or an LLM for calculations.
- AI agents produce validated drafts that a human must accept; accepted drafts journal provenance with provider, model, and prompt hash.
- Do not add cloud sync, accounts, teams, telemetry, payments, or autonomous browsing.

## Git conventions

- Owner: Xeyronox (`getxeyronoxz`). Commit as the configured repo identity; keep
  `Co-Authored-By: Claude <noreply@anthropic.com>` trailers on Claude-assisted commits.
- Work on feature branches off `dev` (e.g. `feature/*`). `dev` is the active line;
  `main` holds the archived V0 (Tauri/Rust) codebase and stays frozen.
- Never rewrite published history without explicit approval from the owner.

## Source and generated files

- Project files are canonical. Reject malformed data; never silently overwrite or recover it.
- The renderer never imports Electron; everything crosses the zod-validated IPC contract in
  `@open-merchant/shared` via `@open-merchant/sdk`.
- API keys live encrypted in app-private user data via `safeStorage`; never in project folders,
  artifacts, logs, IPC responses, tests, or chat.
- `out/`, `release/`, `dist/`, and `coverage/` are build output, not source edits.

## Workflow

- Inspect status, branch, and recent commits before edits. Preserve unrelated work; avoid
  destructive git commands unless explicitly asked.
- Focused tests for behavior changes; systematic debugging for failures; run
  `pnpm -r test && pnpm lint && pnpm typecheck` before claiming completion.
- Electron E2E lives in `apps/desktop/tests/e2e` (`pnpm --filter @open-merchant/desktop test:e2e`);
  unit suites must stay independent of a running Electron instance.

## Commands

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Run desktop app | `pnpm dev` |
| All tests | `pnpm test` |
| Core domain tests | `pnpm --filter @open-merchant/core test` |
| AI agent tests | `pnpm --filter @open-merchant/ai test` |
| Desktop integration tests | `pnpm --filter @open-merchant/desktop test` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` |
| Renderer build | `pnpm build` |
| Installer | `pnpm --filter @open-merchant/desktop dist` |

## Documentation

- Keep `README.md` factual and user-facing and `docs/architecture.md` aligned with shipped behavior.
