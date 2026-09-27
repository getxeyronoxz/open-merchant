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
| `packages/mcp` | Read-only MCP server (`open-merchant-mcp`, stdio only): exposes one project folder's artifacts as MCP resources, validates every read against the shared schemas, journals each read as an `mcpArtifactRead` run, and registers no tools — writes are refused by construction |


## Canonical workspace (format v2)

```text
project/
  .openmerchant/
    manifest.json
    runs.jsonl
    provenance.jsonl
  evidence/sources.jsonl
  market/competitors.json
  market/snapshots/               # phase 2: timestamped captures, immutable except by a currency change
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

Packaged builds check the project's own GitHub Releases feed (`latest.yml`, published by a `v*` tag build on GitHub runners) via `electron-updater` and download delta updates in the background. The check runs at launch and every six hours; a result is cached for a minute and an in-flight check is joined rather than duplicated, so the menu, the timer, and a newly opened window do not each hit the network.

Every one of the contract's five states is emitted — `checking`, `available`, `not-available`, `downloaded`, `error` — and the renderer renders them differently on purpose. "You are on the newest release" and "we could not reach the feed" are different facts, and a failed check is escalated to a `role="alert"` strip rather than rendered as calm news. The strip is always present, quiet when all is well, with a "Check now" action. Status travels over the same validated IPC contract as everything else (`update:status` push events, plus `update/check` and `update/install` request channels), never a native dialog.

There is no telemetry and no third-party service: the update check is a passive read of the owner's release feed, so the local-first boundary holds.

**A version bump is not a release.** The feed is GitHub Releases, so an untagged version has no release to come from and nothing to update to. Only the owner pushes a `v*` tag.

Packaging, per platform: NSIS on Windows; DMG **and** zip on macOS (the zip is not for users — electron-updater's macOS path applies a zip diff, so without it the feed has nothing to patch against); AppImage, `deb`, `tar.gz`, snap, and flatpak on Linux. The AppImage needs `libfuse.so.2`, which Arch dropped for `fuse3`; `deb` and `tar.gz` are the no-FUSE path. The flatpak pins a supported runtime (`26.08`) because Flathub keeps only supported runtimes in its main repository, and CI installs that runtime and its SDK explicitly rather than relying on flatpak-builder's auto-download.

## Phase 2 cockpit

The post-decision layer is computed, never stored twice: market snapshots are immutable files under `market/snapshots/`; the margin monitor derives drift flags from the saved scenarios plus the latest snapshot's median price; the decision journal derives dated entries from the run journal and staleness from evidence `observedAt` timestamps. CSV import/export, `.omarchive` single-file backups (deflated, versioned, path-guarded envelope), and report PDF export all run through the same validated IPC contract — nothing leaves the machine.

## Project currency change

The only operation in the app that rewrites every artifact a project owns, and it is built as plan-then-write rather than as a save. `planCurrencyChange` in `packages/core` is pure: it reads the manifest, competitors, assumptions, scenarios, and market snapshots and returns a list of exact before/after byte pairs plus both combined hashes, having written nothing. The desktop main process derives that plan itself — the plan is never accepted over IPC — and `writeCurrencyPlan` performs it: each artifact through a path the layout module resolves, the manifest last, then a re-read of the resolved files to confirm the on-disk hash equals `plan.afterHash`. Any failure rewrites the captured `before` bytes in reverse order and rethrows, so a project is never left half-converted and never advertised as converted before it is.

Two rules are the reason this is a domain operation rather than a UI loop. First, rates are not money: `new = round(old × rate)` is applied to amounts only, and fee rates, `marginThresholdPercent`, and `grossMarginPercent` are dimensionless and never multiplied. Second, a snapshot's statistics are re-derived from its already-rounded converted listings rather than multiplied, because those are different numbers — the difference is one cent on real data, and the core test pins that case.

The change is journaled to `runs.jsonl` as a `currencyChanged` run carrying a typed `currencyChange` payload: both currencies, the rate, the old and new value maps keyed `<path>#<field>`, the affected artifacts, and the before/after hashes. The run schema requires that payload on a `succeeded` currency change and forbids it everywhere else, so a failed change journals the failure with no payload rather than a conversion that did not happen. The rate is the user's own input — nothing in this path contacts a network or an FX feed — and it is journaled precisely so a later reversal can use the exact rate rather than a fetched one.

## Verification map

| Change area | Minimum verification |
| --- | --- |
| Renderer behavior | Focused Vitest, then `pnpm -r test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` |
| Core/workspace rules | `pnpm --filter @open-merchant/core test` (includes golden parity + real-example import) |
| Agents | `pnpm --filter @open-merchant/ai test` (scripted-provider structured output tests) |
| Installer | `pnpm --filter @open-merchant/desktop dist`, launch packaged app once per platform, and run the staged MCP launcher from inside the packaged tree (`docs/testing-platforms.md`) |
| Electron window & IPC | `pnpm --filter @open-merchant/desktop test:e2e` — drives the real app (real preload, real IPC, real disk); CI runs it under xvfb with a 60s hook timeout |

## Plugin and connector lane

Plugins live in app data (`<userData>/plugins/<id>/manifest.json`), never in a project folder, and
load **disabled**. A plugin is data, not code this app loads: no third-party JavaScript is ever
imported into Electron. A manifest is zod-validated, and a manifest without an `author`, a directory
whose name does not match its `id`, two folders claiming one `id`, or a symlinked folder are all
refused — and every refusal is *listed with its reason* rather than skipped silently, so nothing is
dropped without the seller seeing it.

`minAppVersion` is enforced: a plugin needing a build this one has not reached is refused the same
way, and the minimum is shown on its row. The comparison is semantic versioning's, not a string
compare — `1.0.0-beta.1` sorts after `1.0.0` as text, so a naive compare would let a beta load a
plugin written for the release, which is the exact case the field exists to prevent.

`network: true` is a **disclosed contract the seller accepts at enable time, not a restriction this
app can enforce**: Node cannot stop a spawned process from opening a socket. The Plugins screen
shows the resolved install directory, because the path follows the package name and a plugin in the
wrong place is indistinguishable from one that was ignored.

A `connector` is the one kind that runs something — an external MCP stdio process. It must declare
`writes: ["drafts"]` or the fetch is refused before the process starts, and the environment is
scrubbed to `PATH`/temp only. What it returns arrives on the Draft Desk as **drafts** tagged with
connector id, fetch time, and a SHA-256 hash of the raw response — never as an agent, provider, or
model, and never as project data. A fetch writes nothing to the project: not evidence, not
competitors, not provenance. The only trace is one `connectorFetched` run in `runs.jsonl`, and a
failed fetch leaves the project byte-for-byte untouched, so a third-party process cannot so much as
stamp a failure record.

## Standing reviews

The attention queue is **derived, never stored** — there is no reviews artifact, so it cannot drift
out of step with the evidence it describes, and it is computed against an injected clock so it is
deterministic. Snoozing and dismissing are both journaled to that project's `runs.jsonl` as a
validated disposition, and a disposition records the *occurrence* it silenced rather than just the
review kind, so re-observing your evidence and letting it go stale again raises the nag again
instead of being silenced forever by a decision made about the old data.

## MCP lane (read-only, stdio)

`packages/mcp` runs outside the app process: any MCP host (Claude Desktop, an IDE agent, a script) spawns `open-merchant-mcp <project-folder>` over stdio — a command the app itself resolves and hands over as a paste-ready host config, because the server is staged into the app's resources at build time (`apps/desktop/stage-mcp.cjs` → `process.resourcesPath/mcp`, copied by electron-builder's `extraResources`) — no network socket exists in the package. It reads only the known workspace layout through guarded directory and artifact resolvers in `@open-merchant/core`, validates exact bytes against `@open-merchant/shared`, and appends one guarded `mcpArtifactRead` record per successful read. It registers resources and zero tools: a host attempting any write fails loudly at the protocol level, so external reads stay observable and the canonical write path never loosens.

The CLI is bundled self-contained — zod and the MCP SDK compiled in — so it needs no `node_modules` beside it, which is what makes a single staged file possible. Its reported version comes from its own `package.json` rather than a literal, and a test forbids a semver appearing anywhere in that file: a frozen literal there outlives every release, which is the defect the connector client had first. Each platform gets a launcher it can actually spawn — a `.cmd` on Windows, a `/bin/sh` script elsewhere — and both prefer the Node runtime that ships with the app over anything on `PATH`, so no separate Node install is required.

The config a host needs is generated by the app, per host, because hosts disagree: opencode reads an `mcp` key with the transport spelled `local` and the command as an array, while Claude Code and Claude Desktop read `mcpServers` with `stdio`, a string command, and a separate `args`. Hosts whose format is not verified are deliberately absent from the list rather than guessed. It ships two ways. It is staged into the app's resources, so an installed copy is always present at a path matching its own version and needs no separate Node; and it is published to npm as `open-merchant-mcp`, a single self-contained binary with no runtime dependencies, for the case where the server has to follow a project the app does not own. Both are the same bundle. It publishes as a `bin`-only package: nothing in the repository imports it as a library, and pretending otherwise would mean shipping a build and a public API that nothing consumes.
