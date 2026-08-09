# Open Merchant agent guide

Open Merchant is a modern, premium-feeling, local-first Windows desktop workspace for commerce research. V0 is artifact-first: users own the normal project files, and the workspace—not a chatbot—is the product.

## Boundaries

- React/TypeScript is the desktop UI; Tauri is the application boundary.
- `crates/merchant-core` contains portable, deterministic commerce rules. Use fixed decimal values; never use an LLM or binary floating point for business calculations.
- `crates/merchant-workspace` owns the user-visible files, validation, atomic writes, artifacts, and provenance.
- Keep Windows-specific behavior at the Tauri/platform edge. V0 ships for Windows only.
- Do not add accounts, cloud sync, AI, scraping, marketplace integrations, payments, teams, mobile, or other V1 scope.

## Working safely

- Read the relevant Superpowers skills before work. Use test-driven development for behavior changes, systematic debugging for failures, and verification before completion.
- Preserve user work. Inspect `git status`, branch, worktree, and recent commits before edits. Never discard unrelated changes or use destructive Git commands.
- `main` is founder-controlled. Agents work on `codex/*` branches and submit reviewable pull requests; never merge to `main` without explicit founder approval.
- User project files are canonical. Reject malformed or unsupported data explicitly; do not silently overwrite or recover it.
- `target/`, `dist/`, generated Tauri schema files, installers, and temporary projects are build output, not source edits.

## Commands

```powershell
npm ci
npm run test:run
npm run build
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --all-targets --all-features
npm run tauri build -- --bundles nsis
```

## License and privacy

Open Merchant is `AGPL-3.0-only`. Public copyright attribution is **Xeyronox**; never seek, infer, or expose the author’s private/legal identity.
