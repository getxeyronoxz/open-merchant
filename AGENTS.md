# Open Merchant agent guide

## Product and scope

- Local-first, AI-native commerce research workbench; the user-owned project folder is the product.
- TypeScript pnpm monorepo: Electron app in `apps/desktop`, domain/AI/SDK/UI/shared in `packages/*`.
- Commerce math runs only on arbitrary-precision decimals in `packages/core`. Never use binary floating point or an LLM for calculations.
- AI assistants produce validated drafts that a human must accept; accepted drafts journal provenance with provider, model, and prompt hash.
- Do not add cloud sync, accounts, teams, telemetry, payments, or autonomous browsing.

## Package manager

- Use pnpm with the committed `pnpm-lock.yaml`: `pnpm install`. Node.js 22+.

## Source and generated files

- Project files are canonical. Reject malformed data; never silently overwrite or recover it.
- The renderer never imports Electron; everything crosses the zod-validated IPC contract in `@open-merchant/shared` via `@open-merchant/sdk`.
- API keys live encrypted in app-private user data via `safeStorage`; never in project folders, artifacts, logs, or IPC responses.
- `out/`, `release/`, `dist/`, and `coverage/` are build output, not source edits.

## Safe workflow

- Inspect status, branch, and recent commits before edits. Preserve unrelated work; never use destructive Git commands.
- Work on `codex/*` branches. `main` is founder-controlled; merge only with explicit founder approval.
- Focused tests for behavior changes, systematic debugging for failures, fresh verification (`pnpm -r test && pnpm lint && pnpm typecheck`) before completion.

## Commands

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Run desktop app | `pnpm dev` |
| All tests | `pnpm test` |
| Core domain tests | `pnpm --filter @open-merchant/core test` |
| AI agent tests | `pnpm --filter @open-merchant/ai test` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` |
| Renderer build | `pnpm build` |
| Installer | `pnpm --filter @open-merchant/desktop dist` |

## Documentation

- Keep `README.md` factual and user-facing and `docs/architecture.md` aligned with shipped behavior.
