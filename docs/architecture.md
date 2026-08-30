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
| `packages/core` | Exact-decimal money and economics, statistics, validation, report rendering, atomic file store, known-layout path guards, run/provenance journals, V0→V2 import. No Electron imports — headless-capable and fully unit-tested |
| `packages/ai` | `LlmProvider` seam (Anthropic, OpenAI, Gemini, and local OpenAI-compatible endpoints such as Ollama/LM Studio behind a BYO-key/base-URL registry, deterministic mock) plus six specialist agents producing zod-validated drafts |
| `packages/sdk` | Typed `DesktopClient`; responses re-validated before reaching the UI; failures become coded `AppError`s |
| `packages/ui` | Design tokens ("The Merchant's Ledger") and primitives: Button, Field, ErrorState, EmptyState, LedgerRow |
| `apps/desktop/main` | Window lifecycle, native dialogs, safeStorage-sealed AI key store, per-call `WorkspaceStore` opens |
| `apps/desktop/preload` | Exposes exactly one `invoke(channel, payload)` method; rejects channels outside the contract |

## Canonical workspace (format v2)

```text
project/
  .openmerchant/
    manifest.json
    runs.jsonl
    provenance.jsonl
  evidence/sources.jsonl
  market/competitors.json
  economics/assumptions.json
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

Agents draft; humans accept. Assistant output is validated JSON tied to shared schemas, surfaced in the UI marked as an AI draft, and becomes data only through a normal save channel. Saves carrying an `agent` origin journal a run and provenance records including agent id, provider, model id, prompt hash, and artifact SHA-256. Cloud-provider API keys are encrypted via Electron `safeStorage` into app-private user data; they are never returned over IPC nor written into projects. Local endpoints (Ollama, LM Studio) configure a base URL only — no key, and outbound traffic stays on the user's machine.

## Updates and releases

Packaged builds check the project's own GitHub Releases feed (`latest.yml`, published by a `v*` tag build on GitHub runners) via `electron-updater` and download delta updates in the background. When an update is ready, the renderer shows a non-blocking banner — restart now, or keep working and it installs on quit. The notice travels over the same validated IPC contract as everything else (`update:status` push events plus an `update/install` channel), never a native dialog. There is no telemetry and no third-party service: the update check is a passive read of the owner's release feed, so the local-first boundary holds.

## Verification map

| Change area | Minimum verification |
| --- | --- |
| Renderer behavior | Focused Vitest, then `pnpm -r test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` |
| Core/workspace rules | `pnpm --filter @open-merchant/core test` (includes golden parity + real-example import) |
| Agents | `pnpm --filter @open-merchant/ai test` (scripted-provider structured output tests) |
| Installer | `pnpm --filter @open-merchant/desktop dist`, launch packaged app once per platform |
