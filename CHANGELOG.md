# Changelog

All notable changes to Open Merchant are documented in this file.

## [Unreleased]

### Added
- Project currency change: a project's currency is no longer fixed at creation. The seller enters the rate by hand — there is no network call and no live FX feed — and every stored monetary amount is restated in arbitrary-precision decimals. Fee rates, the margin threshold, and gross margin are percentages, not money, and are never multiplied by a rate. Market snapshots are restated too, and the screen says so before you confirm rather than after.
- The change is previewed, not promised. A preview reads the project and returns the exact before and after values, and the confirm button stays disabled until the currency and rate on screen are the ones the preview was made from — so a confirmed change is always a seen one. The diff shows the first twenty converted values with the old amount struck through, names every file it will write, and the copy says plainly that the change cannot be undone from the app; the run log holds the rate, so the way back is the rate in reverse.
- The write is planned, ordered, and verified. The plan is derived inside the app and never accepted from the renderer, the manifest is written last so a project is never advertised as converted before it is, the combined artifact hash is checked against the bytes actually on disk, and any failure puts back every file it had touched before reporting the error. A project that cannot be read in full is refused outright rather than half-converted, and a change that could not land is journaled as the failure it was.
- The change is on the record: one `currencyChanged` run in the project's `runs.jsonl` carries the rate, both currencies, the old and new value maps, and the before and after hashes. A failed change journals with no payload at all — a run record cannot describe a conversion that did not happen.
- Standing reviews: a "Needs attention" queue on the Home screen answers *what needs attention this week?* across every project at once, not one folder at a time. It surfaces the signals the core already computed but only ever showed inside a single project — evidence past the 30-day staleness window, margin scenarios sitting in the watch band or past the seller's threshold, and economics priced but never turned into a report. Nothing polls and no server is involved; the queue is derived from artifacts already on disk each time it is read.
- Snoozing and dismissing a review are both journaled in that project's `runs.jsonl`, so a dismissal is a decision on the record rather than a shrug. A snooze holds the reminder for a week. Each disposition records the *occurrence* it silenced, not just the review kind, which means re-observing your evidence and letting it go stale again next year surfaces the nag again instead of being silenced forever by a decision you made about the old data.
- Workspace orientation: the toolbar now shows a project / section breadcrumb alongside the ellipsized folder path, so you always know where you are and where the files live.
- Alt+1…9 section shortcuts jump between the six workspace sections, Draft Desk, Plugins, and AI settings without reaching for the mouse; the rail shows the numbers and nav buttons expose `aria-keyshortcuts` for accessibility hosts. Shortcuts are ignored while typing.
- Draft Desk: one visible triage lane for the six existing assistants. Evidence, competitor, and report-section drafts are editable and require explicit Accept/Discard; research plans, economics reviews, and report audits are review-only. Provenance (agent, provider, model, prompt hash) is visible before any acceptance. The queue is now keyboard-triageable: ArrowLeft/ArrowRight step through waiting drafts and wrap, with a "← → step" hint and `aria-keyshortcuts` on the tablist; the keys are ignored while typing, matching the shell's Alt+digit guard.
- README: a "Getting around" section (breadcrumb, shortcuts, walkthrough guide), a note on how the demo GIF is produced, and a Star History chart.
- MCP connector client: an enabled connector can be run from the Plugins screen with a one-line query. The main process speaks the real MCP stdio protocol (`@modelcontextprotocol/client`), spawning the connector's declared command as the user with a scrubbed environment, a 2 MB response cap, and a 30 s timeout. A connector that does not declare `writes: ["drafts"]`, exposes a missing or duplicated tool, or returns nothing usable is refused before anything is written.
- Connector results arrive as drafts on the Draft Desk, never as data. Each carries its connector id, plugin id, fetch time, and a SHA-256 hash of the raw response, shown in the provenance block in place of an agent/model/prompt-hash — a connector draft is never dressed up as an AI draft. The Draft Desk's queue is now shared across the workspace, so a fetch started on one screen can be reviewed on another.
- The SDK's in-memory mock client implements the connector fetch, and a new guard test keeps every runtime source in `@open-merchant/sdk` free of `node:` imports — the renderer imports that barrel, so a node builtin there would follow the mock into a browser bundle.

### Changed
- The app moves to the `1.0.0-beta.x` line, as the ROADMAP's Phase 3 versioning rule states. `1.0.0` is not claimed here: the roadmap reserves it for publishing the interchange specification (item 7), because publishing a format is a compatibility promise, and only the owner cuts the tag that publishes a build.
- The version a connector is told is now the version the running app was packaged with. The MCP client was constructed with a literal `1.0.0-alpha.4`, so every connector in every later release was told it was talking to an alpha it had stopped being — a connector gating on `minAppVersion` was answering against a number frozen at the last alpha tag.
- Plugin rows: "Fetch drafts" and "Enable" carried the base `.om-button` class with no variant, which supplies spacing and a focus ring but no background and no border. Both rendered as bare text beside a properly styled "View source". Enabling a plugin now reads as the affirmative act it is, and disabling reads as the destructive direction it is.
- Haptic UI pass across the app: all four button variants lift on hover and sink on press (polish now owned by the `@open-merchant/ui` design system), and every clickable ledger surface — nav rail, recent-project cards, walkthrough steps, provider tiles, history rows, artifact rows, diff tabs — answers the pointer with consistent press feedback.
- Demo recorder v2 (`record.cjs`): captures motion frames during typing, scrolling, hovering, and panel transitions (select-all before typing so pre-filled money fields pass `pattern` validation, and waiting for the assumptions-saved badge before Calculate); `gif.mjs` holds motion frames 90ms and keyframes longer. On the owner's request the published `docs/media/demo-loop.gif` was re-captured (141 frames, full motion at 960x600): the run now closes on the Phase 3 Draft Desk, showing the Assistant lane and its standing *Human acceptance required* badge with an honestly empty queue, since a capture run has no AI keys and the recorder never fabricates a result. The closing frame is held 1600ms so the rule reads.
- ROADMAP Phase 3 rewritten as the connected-workbench plan (MCP server mode, triage inbox, MCP connector client, standing reviews, plugin surface, currency change, interchange spec), gated on the draft-gate principle, with the competitive research note in `docs/research/phase-3-connected-workbench.md`.
- Docs & repo hygiene: architecture verification map gains the real-app Electron E2E row; owner-only authorship and dependency-alert triage policy documented; local agent scratch output (`.agent/`) ignored.

### Security
- `extract-zip` patched against CVE-2026-19693 (GHSA-7pqw-9j4j-h8q3): pinned the upstream containment fix through `pnpm.patchedDependencies` so writes through a symlink at the entry's final path component are refused. Build-time-only dependency of the Electron install script; never shipped in installers.

### Fixed
- `minAppVersion` is now actually enforced. The field was declared in every plugin manifest, format-checked, documented as the thing that "prevents silent breakage across app versions" — and never compared with anything. A plugin could require a build this app had not reached and load anyway. A plugin whose minimum this build does not meet is now refused and listed with its reason, like every other refusal, and the minimum is shown on the plugin row. The comparison is semantic versioning's, not a string compare: `1.0.0-beta.1` sorts *after* `1.0.0` as text, so a naive compare would have let this beta load a plugin written for the release — exactly the case the field exists to refuse. A store that is not told which build it is enforces nothing rather than guessing a floor.
- The MCP server no longer reports a version frozen at `1.0.0-alpha.0`. It told every MCP host it was the first alpha, in every beta and in 1.0. This was the same defect the connector client had, fixed on the connector side and left in place here; the version now comes from the package manifest, and a test forbids a semver appearing anywhere in that file — including in a comment.
- Keyboard and screen-reader pass over the workspace. Every defect below was checked against the source before it was changed, and each is covered by a test that fails without its fix.
- The Draft Desk's ArrowLeft/ArrowRight queue shortcut was a `window` listener that called `preventDefault()` on every press, so while that screen was open the shell could not be scrolled with the keyboard at all. Worse, pressing left or right while focused on Accept or Discard silently changed which draft was under review, and the next Enter accepted a draft nobody had read. The shortcut now steps the queue from the page and from the tabs, and stays out of the way on buttons, links, and anything being typed into. The tablist takes a roving `tabindex`, so one Tab lands on the draft being read and its arrow keys move focus as a tablist's own contract requires.
- All six assistant buttons shared one pending flag, so whenever any one ran, all six read "Working…" — the lane claimed six things were in flight when one was, and the button you were actually waiting on looked the same as the five that had not started. Only the running assistant says so now.
- The standing-review card tracked which review was pending but not which action, so dismissing a review left the *Snooze* button saying "Working…" — naming a week-long hold that was never taken. The in-flight action is carried now, and the button that is busy is marked with `aria-busy`.
- The busy Snooze and Dismiss buttons used a real `disabled`, which removes the button you just pressed from the tab order and drops focus to `<body>`, throwing a keyboard user back to the top of the page mid-task. They are `aria-disabled` with a guarded click handler, dressed the same as before.
- The AI provider picker was a `role="radiogroup"` containing plain toggle buttons — a radio group with no radios in it. They are real radios now, with `aria-checked`, roving `tabindex`, and arrow-key selection, which is what makes a radio group usable from the keyboard at all.
- The generations list put `role="listitem"` on the button itself, which overrode the button role: rows were announced as list items that could not be pressed. The role moved to a wrapping `<li>`.
- Every `Field` in the app put its hint *inside* the `<label>`, so the hint became part of every control's accessible name. The connector query field on the Plugins screen announced its ~200-character explanation instead of "What should it look for?". Hints are now siblings of the label, attached with `aria-describedby`, so they are still announced — as descriptions, where they belong. The control's id is generated with `useId`, so no call site has to thread one.
- Two file inputs — restore-from-archive and CSV import — were labelled with a `<span>` rather than a `<label>`, so they had no accessible name at all. Both use the design system's `Field` now, which is what that hand-rolled markup was imitating.
- Every field of every market-observation row was named "Label", "Value", "Unit" — identical on each row, so three rows were indistinguishable. They are indexed, matching the "Remove observation N" convention already used in the same file.
- "Completed" on a finished workspace step lived only in a `title` attribute on a "✓", which is not a tooltip for a keyboard or screen-reader user. The glyph carries a name now.
- The selected artifact was marked by border colour and nothing else, so selection did not exist for anything that cannot see colour. It is `aria-current`, and the selected row shifts weight as well as hue.
- "View source" on a plugin was `aria-pressed`, but clicking it could only ever set the selection and never clear it — a toggle it could not perform. It is a disclosure now (`aria-expanded`, pointing at the source region), and clicking the plugin whose source is already showing closes it again.
- Money fields read "Product ()" on the first render, before the manifest arrives. An empty parenthesised slot reads as a bug rather than a value that has not loaded, so the currency is appended only when there is one.
- The built desktop app could not open a window. `apps/desktop` is `"type": "module"`, so electron-vite emits the main process as ESM, where `__dirname` does not exist — `createMainWindow` threw `ReferenceError: __dirname is not defined` before any window was created, and the whole Electron end-to-end suite failed on every test on the machine where this was found. The main directory is now derived from the module URL. E2E is 4/4.
  - Not yet explained: CI ran that same code on Linux, Windows, and macOS and reported the E2E suite green, including the built main process. The fix is correct either way (`__dirname` is undefined in ESM by definition), but the reason the defect survived a green CI run on the identical commit is not understood, and is worth resolving before `v1.0`.
- Electron end-to-end suite: vitest `hookTimeout` raised to 60s — cold CI runners exceeded the 10s default launching Electron under xvfb even though every test passed.

## [1.0.0-alpha.4] - 2026-09-17

### Added
- Phase 2 cockpit: market snapshots (immutable timestamped captures with per-listing price history and snapshot diffs), margin monitoring (per-project threshold with market-drift flags), decision journal (any-two report comparison plus stale-evidence flags), and a portfolio overview (every project on one screen, worst-margin first).
- File-first pillar: CSV export for competitors, evidence, and scenarios; validated CSV import with auto-detected column mapping and per-row error reporting; portable single-file `.omarchive` project backups; and print-perfect PDF export of the generated report.
- Linux universal packages: snap and flatpak targets join AppImage in the release workflow.
- AI assistants: stronger shared system prompts — groundedness, honesty about gaps, analyst-grade tone, and strict JSON discipline.

### Changed
- Home screen redesign: the recents panel now leads with a full-width "New workspace" call-to-action above a ruled divider of recent decisions (with a count badge), the hero gains a quiet trust strip (no accounts / no cloud sync / no telemetry), the portfolio card spans its full row instead of stranding in a half-empty grid column, recent listings get lift-and-glow hover with a sliding arrow, and buttons gain ledger-style inset highlights with consistent press feedback.
- Home screen gains the portfolio overview table; new panels carry explicit empty-state guidance.
- Windows builds use an integrated title-bar overlay in the Ledger palette; the top chrome drags the window and every control inside stays clickable.
- AI settings: connection-test failures surface as `ai-provider-error` with human-readable provider messages (key rejected / unknown model / rate limit / temporary overload) instead of raw provider JSON mislabeled as `storage-error`.
- AI settings: default model IDs refreshed to current provider lineups (Anthropic `claude-sonnet-5`, OpenAI `gpt-5.6-terra`, Gemini `gemini-3.8-flash`, local `qwen3.5:9b`); the Competitors snapshot card and decision-journal report pickers get their intended two-column layout with proper spacing.
- AI providers: transient failures (HTTP 429/5xx — load spikes and rate limits) are retried automatically with short backoff, honoring the provider's `Retry-After` when sent; permanent failures (rejected key, unknown model) fail immediately. A Gemini 503 "high demand" spike now usually recovers without a manual retry.
- Report: generation stays disabled with a "set your selling prices first" guide (and a jump to Economics) until all three scenario prices exist — the missing-prices error is now prevented, not just reported. When generation still fails on invalid input (e.g. prices removed after the fact), the error offers "Open Economics" to fix the cause instead of a retry that would fail identically; transient failures keep their retry button.
- CI: the Electron end-to-end suite runs on every push to `dev`; the release workflow is hardened with a concurrency guard against racing publishes, a job timeout, an Electron-binary cache, and a least-privilege checkout.

### Security
- Fixed all open Dependabot and CodeQL alerts ahead of launch: vitest upgraded 3.2.7 → 4.1.11 across every package (path-traversal via `@vitest/mocker` redirect mock, CVE-2026-84373), `js-yaml` pinned to the patched 4.3.2 via a pnpm override (merge-keys CPU exhaustion, CVE-2026-84375), and the local-endpoint URL trim in the AI provider layer rewritten without a polynomial regular expression (CodeQL #4).
- Snap packages now build under a valid explicit name (`open-merchant`) instead of deriving one from the scoped package name, which made `mksquashfs` fail on release runs.
- Known, documented exception: `extract-zip` 2.0.1 (CVE-2026-56876, symlink path traversal) has no patched release. It is a dev-only transitive dependency of the `electron` package used solely to unzip the official Electron distribution on developer machines — it is never shipped in installers and never processes user-supplied archives. The alert is dismissed with reason `no_fix_planned` until upstream publishes a fix.

### Fixed
- Binary-safe `.omarchive` download: archives downloaded from Files & history were decoded through UTF-8 text (corrupting every byte ≥ 0x80) and could not be restored; they now download as raw bytes.
- CSV import now imports the `notes` column instead of silently dropping it — competitor notes round-trip through the file-first pillar (found by new boundary tests).
- Recent-projects list is capped at the 20 most recent workspaces (it previously grew unbounded and every entry renders on Home), and a malformed recents file is quarantined beside the fresh list instead of being silently destroyed.
- Snap packaging: an invalid snap option was dropped so local `dist` builds (and the snap target) run cleanly.

## [1.0.0-alpha.3] - 2026-09-03

### Added

- Custom application menu: a purpose-built menu replaces the default Electron menu, matched to the app's structure and actions.
- In-app update banner: update notices now appear inside the app as a dismissible banner instead of a native dialog, carried over the validated IPC contract (new shared schemas, typed SDK methods, and in-memory mock coverage).
- Scripted demo recorder: `record.cjs` drives a real build through the evidence → competitors → economics → report loop with Playwright and `gif.mjs` assembles the frames with gifenc (pure JS, no ffmpeg) — no AI keys, no network — producing the `docs/media/demo-loop.gif` now embedded in the README.
- Build-in-public thread draft (`docs/marketing/build-in-public-thread.md`) and an onboarding validation kit (`docs/onboarding-validation-kit.md`) for the first unaided-user check.
- Release workflow signature checks: the release CI verifies artifact signatures before publishing.

### Changed

- The renderer client only probes `window.openMerchant` when a `window` exists, so the module imports safely outside a browser context; behavior inside Electron and the dev-server mock is unchanged.

## [1.0.0-alpha.2] - 2026-08-30

### Added

- Richer artifact viewer: the Artifacts tab now answers "what changed since last time" without opening raw files — a side-by-side diff of the latest generated report against the previous generation (LCS line alignment, removed/added highlighting, equal-height paired columns), plus filtered provenance search over the run journal by agent, provider, model, and text.
- Run history surface: the deterministic core records a per-workspace generation history; the typed SDK, in-memory mock, and main-process service expose it over the validated IPC contract. Covered by new core unit tests, a service-level integration test, mock-client tests, a diff unit suite, and the Electron e2e.

## [1.0.0-alpha.1] - 2026-08-28

### Added

- Onboarding: one-time first-run welcome card on an empty Home (create → feed → decide), a standing invitation after dismissal, an "AI assistants are optional" tip inside the walkthrough guide, and reopen targeting that lands mid-walkthrough projects on their first incomplete step. Renderer-only; unit and e2e covered.
- More providers: Google Gemini and local OpenAI-compatible endpoints (Ollama, LM Studio) behind the BYO-key registry. Local endpoints need only a base URL — no key, no cloud. A shared HTTP provider contract suite runs identically across all four providers.
- Auto-update: `electron-updater` performs a passive check against the project's own GitHub Releases feed; delta downloads with restart-or-quit install. A `v*` tag pushes build and publish NSIS/DMG/AppImage to Releases from GitHub runners. Local device testing supported via `OPEN_MERCHANT_TEST_UPDATE_URL` and a self-signed developer certificate (`dev-signing.ps1`, alias-only identity).
- App icon: the Merchant's Ledger mark (brass serif M, ledger leaders, accent coin) across window, taskbar, and installers.

### Changed

- UI quality pass: layered card depth, glowing input focus, table row hover, accent-dot empty states, dual-glow canvas, gradient brass hero, hover motion on recents, and a styled four-card AI provider picker.
- Electron upgraded 37.10.3 → 39.8.10, clearing 63 Dependabot advisories in the shipped runtime.
- CI verifies every push to `dev` on Windows/macOS/Linux and fixes the pnpm version conflict that had silently broken the verify job.

### Security

- All open Dependabot alerts (64, including context-isolation bypasses and sandbox escapes) and all code-scanning warnings resolved; secret scanning clean.

## [1.0.0-alpha.0] - 2026-08-26

### Changed

- Complete rebuild on a TypeScript pnpm monorepo: Electron desktop app with packages for the shared IPC contract, domain engine, AI agents, typed SDK, and design system. The legacy Tauri/Rust implementation is retired; its deterministic semantics survive through golden parity tests.
- New workspace format v2: `.openmerchant/manifest.json` plus JSON/JSONL artifacts, atomic replace-on-success writes, known-layout path guards, and run/provenance journals that record agent id, provider, model, prompt hash, and artifact fingerprints for accepted AI drafts.
- Six specialist AI assistants (research planner, evidence assistant, competitor analyst, economics reviewer, report writer, auditor) produce zod-validated drafts the user must accept; bring-your-own Anthropic or OpenAI key, sealed with OS-backed storage.
- Rebuilt UI on a new dark-first design system ("The Merchant's Ledger") with TanStack Query, coded error states with retry, ledger-style statistics rows, and generated reports rendered as paper documents.
- Deterministic commerce math preserved exactly: arbitrary-precision decimals, half-away-from-zero rounding at emission only; outputs pinned by golden fixtures.
- One-time V0 -> V2 project import replaces direct opening of legacy folders.

### Removed

- Legacy planning documents under `docs/superpowers/` and the superseded manual smoke/demo guides.

## [0.1.0] - 2026-08-08

### Added

- Windows-first Tauri desktop workspace for local commerce/product research.
- Create, open, and reopen user-owned project folders.
- Research objectives, evidence records, competitor comparison, deterministic price statistics, and fixed-decimal unit economics.
- Markdown opportunity reports, artifact inspection, run history, and SHA-256 provenance records.
- Mechanical Keyboards India example project and demo workflow documentation.
- Windows NSIS bundle configuration, frontend/Rust test suites, and CodeQL analysis.

### Fixed

- Restored persisted economics scenarios when reopening a project.
- Hidden the Windows console window for production desktop builds.

### Security

- Licensed Open Merchant under `AGPL-3.0-only` and added a security reporting policy.
