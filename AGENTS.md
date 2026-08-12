# Open Merchant agent guide

## Product and scope

- Windows-first, local-first commerce research workspace; the user-owned project folder is the product.
- React/TypeScript UI → Tauri application layer → Rust workspace/domain crates.
- `crates/merchant-core`: portable fixed-decimal rules. Never use an LLM or binary floating point for commerce calculations.
- `crates/merchant-workspace`: validation, known workspace paths, atomic writes, artifacts, and provenance.
- Do not add accounts, cloud sync, AI, scraping, integrations, payments, teams, mobile, telemetry, or other V1 scope.

## Package manager

- Use npm and the committed `package-lock.json`: `npm ci`, never a substitute lockfile.

## Source and generated files

- Project files are canonical. Reject malformed or unsupported data; never silently overwrite or recover it.
- Keep Windows-specific behavior at the Tauri/platform edge.
- `target/`, `dist/`, Tauri schema output, installers, and temporary projects are build output, not source edits.
- `src-tauri/app-icon.svg` is the canonical app mark. Regenerate and commit bundle icons with `npm run tauri -- icon src-tauri/app-icon.svg --output src-tauri/icons`.

## Safe workflow

- Inspect status, branch, worktree, and recent commits before edits. Preserve unrelated work; never use destructive Git commands.
- Work on `codex/*` branches. `main` is founder-controlled; merge only with explicit founder approval.
- Use focused tests for behavior changes, systematic debugging for failures, and fresh verification before completion.
- Keep UI premium, calm, keyboard-accessible, and reduced-motion safe.

## Commands

| Task | Command |
| --- | --- |
| Install | `npm ci` |
| Frontend test | `npm run test:run -- src/features/home/HomeScreen.test.tsx` |
| Rust crate test | `cargo test -p merchant-core --test economics` |
| Full frontend test | `npm run test:run` |
| Frontend build | `npm run build` |
| Rust checks | `cargo fmt --all -- --check`; `cargo clippy --workspace --all-targets --all-features -- -D warnings`; `cargo test --workspace --all-targets --all-features` |
| Windows package | `npm run tauri build -- --bundles nsis` |

## Documentation

- Keep `README.md` factual and user-facing. Keep architecture, manual smoke, and contributor guidance aligned with shipped V0 behavior.
- Treat `docs/superpowers/` as historical planning material; do not present it as current product behavior.

## Commit attribution

- Use the configured Git identity; do not invent contributor names, private identities, or attribution.
- Open Merchant is `AGPL-3.0-only`; public copyright attribution is **Xeyronox**.
