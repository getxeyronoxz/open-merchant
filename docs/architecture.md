# Open Merchant V1 Architecture

## Product boundary

Open Merchant is a local-first desktop workspace for commerce research. It hosts no service, reads no remote pages by itself, and never sends project data anywhere except to the LLM provider you configure, with only the content you explicitly submit for drafting. The selected project folder is the canonical record.

## Runtime path

```text
React 19 renderer (apps/desktop/src/renderer)
  -> @open-merchant/sdk typed client
    -> contextBridge preload (sandboxed, channel allowlist)
      -> single IPC dispatcher (zod-validated both ends)
        -> MerchantService (apps/desktop/src/main)
          -> @open-merchant/core   domain + workspace engine
          -> @open-merchant/ai     provider-agnostic agents
            -> user-owned project folder / provider API (cloud HTTPS or local endpoint)
```

| Area | Responsibility |
| --- | --- |
| `packages/shared` | Single source of truth: zod schemas for every artifact, the IPC contract map, coded errors, agent output shapes |
| `packages/core` | Exact-decimal money and economics, statistics, validation, report rendering, atomic file store, known-layout path guards, run/provenance journals, V0→V2 import. Phase 2 adds market snapshots (immutable captures + derived history/diffs), the margin monitor, the decision journal, CSV in/out, portable `.omarchive` archives, and print-to-PDF rendering. No Electron imports — headless-capable and fully unit-tested |
| `packages/ai` | `LlmProvider` seam (Anthropic, OpenAI, Gemini, and local OpenAI-compatible endpoints such as Ollama/LM Studio behind a BYO-key/base-URL registry, deterministic mock) plus six specialist agents producing zod-validated drafts |
| `packages/sdk` | Typed `DesktopClient`; responses re-validated before reaching the UI; failures become coded `AppError`s |
| `packages/ui` | Design tokens ("The Merchant's Ledger") and primitives: Button (hover-lift / press-sink), Field, Card, Badge, LedgerRow, table, feedback states |
| `apps/desktop/main` | Window lifecycle, native dialogs, safeStorage-sealed AI key store, per-call `WorkspaceStore` opens, PDF rendering via a hidden `printToPDF` window, portfolio aggregation over the recents store |
| `apps/desktop/preload` | Exposes exactly one `invoke(channel, payload)` method; rejects channels outside the contract |
| `packages/mcp` | Read-only MCP server (`@open-merchant/mcp`, stdio only): exposes one project folder's artifacts as MCP resources, validates every read against the shared schemas, journals each read as an `mcpArtifactRead` run, and registers no tools — writes are refused by construction |


## Canonical workspace (format v2)

```text
project/
  .openmerchant/
    manifest.json
    runs.jsonl
    provenance.jsonl
  evidence/sources.jsonl
  market/competitors.json
  market/snapshots/               # phase 2: immutable timestamped captures
    SNAP-<utcstamp>-<hex>.json
  economics/assumptions.json      # includes the margin-monitor threshold
  economics/scenarios.json        # generated
  reports/report-sections.json
  reports/opportunity-report.md   # generated
```

- User-owned files are inputs; generated files carry fingerprints in journals.
- Every write is atomic replace-on-success (temp file + rename).
- The artifact reader resolves only the known layout and refuses traversal, absolute paths, unknown paths, symlinks, and realpath escapes.
- Money crosses boundaries only as decimal strings; rounding is half-away-from-zero at emission, pinned by golden fixtures derived from the legacy Rust engine.
- Malformed or unsupported data is rejected loudly, never repaired.

## AI model

Agents draft; humans accept. The Draft Desk is the visible review lane: it shows the agent, provider, model, and prompt hash before any action, keeps review-only outputs (research plan, economics review, report audit) out of the write path, and allows actionable evidence, competitor, and report-section drafts to be edited, accepted, or discarded. Accepted output crosses the same zod-validated IPC save channels as manual edits and becomes data only through that normal save channel. Saves carrying an `agent` origin journal a run and provenance records including agent id, provider, model id, prompt hash, and artifact SHA-256. Cloud-provider API keys are encrypted via Electron `safeStorage` into app-private user data; they are never returned over IPC nor written into projects. Local endpoints (Ollama, LM Studio) configure a base URL only — no key, and outbound traffic stays on the user's machine.

## Updates and releases

Packaged builds check the project's own GitHub Releases feed (`latest.yml`, published by a `v*` tag build on GitHub runners) via `electron-updater` and download delta updates in the background. When an update is ready, the renderer shows a non-blocking banner — restart now, or keep working and it installs on quit. The notice travels over the same validated IPC contract as everything else (`update:status` push events plus an `update/install` channel), never a native dialog. There is no telemetry and no third-party service: the update check is a passive read of the owner's release feed, so the local-first boundary holds. Linux ships three containerized formats — AppImage, snap, and flatpak — built by the same tagged workflow.

## Phase 2 cockpit

The post-decision layer is computed, never stored twice: market snapshots are immutable files under `market/snapshots/`; the margin monitor derives drift flags from the saved scenarios plus the latest snapshot's median price; the decision journal derives dated entries from the run journal and staleness from evidence `observedAt` timestamps. CSV import/export, `.omarchive` single-file backups (deflated, versioned, path-guarded envelope), and report PDF export all run through the same validated IPC contract — nothing leaves the machine.

## Verification map

| Change area | Minimum verification |
| --- | --- |
| Renderer behavior | Focused Vitest, then `pnpm -r test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` |
| Core/workspace rules | `pnpm --filter @open-merchant/core test` (includes golden parity + real-example import) |

## MCP lane (read-only, stdio)

`packages/mcp` runs outside the app process: any MCP host (Claude Desktop, an IDE agent, a script) spawns `open-merchant-mcp <project-folder>` over stdio — no network socket exists in the package. It reads only the known workspace layout through guarded directory and artifact resolvers in `@open-merchant/core`, validates exact bytes against `@open-merchant/shared`, and appends one guarded `mcpArtifactRead` record per successful read. It registers resources and zero tools: a host attempting any write fails loudly at the protocol level, so external reads stay observable and the canonical write path never loosens.

| Agents | `pnpm --filter @open-merchant/ai test` (scripted-provider structured output tests) |
| Installer | `pnpm --filter @open-merchant/desktop dist`, launch packaged app once per platform |
| Electron window & IPC | `pnpm --filter @open-merchant/desktop test:e2e` — drives the real app (real preload, real IPC, real disk); CI runs it under xvfb with a 60s hook timeout |
