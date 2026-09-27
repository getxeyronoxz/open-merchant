# Changelog

All notable changes to Open Merchant are documented in this file.

## [Unreleased]

## [1.0.0] - 2026-09-27

The first stable release. Phase 3 is in: the read-only MCP server, the connector client, the
plugin surface, standing reviews, the Draft Desk, and the project currency change. `1.0.0` is a
promise about one thing — that a version 2 project folder keeps opening — not a published format;
the interchange-spec item was withdrawn by owner decision.

### Added
- macOS and Linux get a proper launcher for the bundled MCP server. Only Windows had one; elsewhere the app handed a host a bare `.mjs` whose executable bit had to survive being copied into a DMG, an AppImage, or a snap — with no fallback and no explanation if it didn't. A `/bin/sh` launcher now stages for those platforms (LF endings, executable, resolving its own directory with parameter expansion so it depends on nothing outside the shell), and prefers the Node runtime that ships with the app over whatever is on `PATH`. This matters most on macOS, where a GUI-launched app has a minimal `PATH` and the person may never have installed Node. When the app's own runtime is not where the launcher expects — `Contents/MacOS` for a `.app`, the install root elsewhere — it falls back to `node`, and refuses with a named cause if there is none or it predates Node 20. Staging is now per-platform, so a macOS build no longer ships a `.cmd`, and the POSIX launcher is covered by tests that build both a fake `.app` and a fake Linux install tree.
- `docs/platform-notes.md`: what genuinely differs per platform, and what is known-shaky — the snap's per-release data directory, connector behaviour under snap/flatpak confinement, and macOS notarisation status.
- The MCP config the app hands over is now a **choice of hosts, not one snippet**. opencode reads a `mcp` key with the transport spelled `local` and the command as an array; Claude Code and Claude Desktop read `mcpServers` with the transport `stdio`, a string command, and a separate `args`. A single snippet was a guess that half of them silently would not read. The app asks which you use, shows the file it belongs in, and — where the host supports it — the one-line command that registers the server without editing a file. Both formats are pinned by tests against their hosts' published configuration, and `docs/mcp-hosts.md` records them with sources. Hosts whose format is not verified are deliberately absent: an unverified snippet looks authoritative and fails in a way that is hard to diagnose.
- A runnable sample connector, in `examples/sample-connector`. The connector path was fully built and fully tested, but the only connector in the repository was a test fixture that wrote a manifest and explicitly was not a server — so the feature shipped with nothing to run. This is a real MCP stdio server with **no dependencies at all**: no SDK, no `npm install`, nothing to fetch. It returns clearly-marked sample listings that arrive on the Draft Desk as drafts, and it writes nothing. Because it has no SDK, it is also the one test that runs a connector as a real child process against the real MCP client, so a hand-written server interoperating with the official client is proven rather than assumed.
- The Plugins screen now shows the exact folder to install a plugin into. The path follows the app's package name, so it is not something a seller can be expected to guess — and a plugin dropped in the wrong place looks exactly like a plugin that was ignored. The README lists the per-platform paths as a reference, but the app is the authority.
- `open-merchant-mcp` is published to npm as a single self-contained binary with no runtime dependencies — the same bundle the app ships — for anyone who needs the server to follow a project the app does not own. It publishes bin-only: nothing imports it as a library, and its `bin` had been pointing at a `dist/cli.js` that stopped existing when the bundle was made self-contained, so `npx` would have failed on a missing file.
- The read-only MCP server now ships inside the app, and the app will hand you the config for it. It was complete and thoroughly tested but unreachable: `packages/mcp` is a private, unpublished package and the installer shipped only `out/**`, so no released build contained a server and the only person who could run one had this repository checked out. It is built self-contained now — its dependencies bundled in, so it needs no `node_modules` beside it — and staged into the app's resources at build time, at a path that always matches the version carrying it. On Windows the staged `.cmd` runs it through the Node runtime that ships with the app, so no separate Node install is required. The Plugins screen shows the resolved path and a ready-to-paste host config for the project you are looking at, and says plainly when the server is not present rather than pointing a host at a file that is not there.
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
- The update state is now visible in the app, not only in a menu dialog. A permanent strip says which of the five states you are actually in — checking, up to date, downloading, ready to install, or **could not check** — with a "Check now" action. When all is well it is a quiet line that still names the version you are on, so "up to date" is something the app can say rather than something inferred from silence. A failed check escalates instead of reading as calm news.

### Changed
- The app moves to the `1.0.0-beta.x` line, as the ROADMAP's Phase 3 versioning rule states. `1.0.0` is not claimed here: the roadmap reserves it for publishing the interchange specification (item 7), because publishing a format is a compatibility promise, and only the owner cuts the tag that publishes a build.
- The version a connector is told is now the version the running app was packaged with. The MCP client was constructed with a literal `1.0.0-alpha.4`, so every connector in every later release was told it was talking to an alpha it had stopped being — a connector gating on `minAppVersion` was answering against a number frozen at the last alpha tag.
- Plugin rows: "Fetch drafts" and "Enable" carried the base `.om-button` class with no variant, which supplies spacing and a focus ring but no background and no border. Both rendered as bare text beside a properly styled "View source". Enabling a plugin now reads as the affirmative act it is, and disabling reads as the destructive direction it is.
- Haptic UI pass across the app: all four button variants lift on hover and sink on press (polish now owned by the `@open-merchant/ui` design system), and every clickable ledger surface — nav rail, recent-project cards, walkthrough steps, provider tiles, history rows, artifact rows, diff tabs — answers the pointer with consistent press feedback.
- Demo recorder v2 (`record.cjs`): captures motion frames during typing, scrolling, hovering, and panel transitions (select-all before typing so pre-filled money fields pass `pattern` validation, and waiting for the assumptions-saved badge before Calculate); `gif.mjs` holds motion frames 90ms and keyframes longer. On the owner's request the published `docs/media/demo-loop.gif` was re-captured (141 frames, full motion at 960x600): the run now closes on the Phase 3 Draft Desk, showing the Assistant lane and its standing *Human acceptance required* badge with an honestly empty queue, since a capture run has no AI keys and the recorder never fabricates a result. The closing frame is held 1600ms so the rule reads.
- ROADMAP Phase 3 rewritten as the connected-workbench plan (MCP server mode, triage inbox, MCP connector client, standing reviews, plugin surface, currency change, interchange spec), gated on the draft-gate principle, with the competitive research note in `docs/research/phase-3-connected-workbench.md`.
- Docs & repo hygiene: architecture verification map gains the real-app Electron E2E row; owner-only authorship and dependency-alert triage policy documented; local agent scratch output (`.agent/`) ignored.

### Security
- CodeQL flagged two high-severity findings in the MCP host-config helper this release added, both in the shell-quoting function that built a `claude mcp add` one-liner: a polynomial-time regular expression, and a sanitizer that does not escape backslashes. Both were real. The function was **removed rather than repaired** — quoting correct in `cmd` is wrong in PowerShell and a no-op in `sh`, so no single escaper is correct, and an incomplete one hands a user a path that looks quoted and is not. The JSON snippet is exact and portable and is now the only thing the app generates; the CLI form is documented for people who prefer it, with their own paths in it.
- `extract-zip` patched against CVE-2026-19693 (GHSA-7pqw-9j4j-h8q3): pinned the upstream containment fix through `pnpm.patchedDependencies` so writes through a symlink at the entry's final path component are refused. Build-time-only dependency of the Electron install script; never shipped in installers.

### Fixed
- A development build announced Electron's version as its own. The `app.isPackaged` guard lived only in `initAutoUpdate`, so the renderer and the menu — which call `checkForUpdates` directly — bypassed it, reached the network with no feed, and rendered "You are on 39.8.10, the newest release" about software that is not Open Merchant. The guard moved into `checkForUpdates` itself, and a build with no updater now reports an explicit `unavailable` state and says nothing.
- The demo recorder only worked when run from `apps/desktop`. It passed `./out/main/index.js` relative to the working directory, so running it from the repository root — the obvious way, and the one this README implies — launched nothing and failed with no useful message. The path resolves against the file now, and `pnpm --filter @open-merchant/desktop demo` does both steps.
- The flatpak was built against runtime `23.08`, an end-of-life runtime from 2023. Flathub keeps only supported runtimes in its main repository, so a flatpak built against one cannot be installed on a current system — which is a refused install with no useful error. It now targets `26.08`, verified against the Flathub runtime list, and CI installs that runtime and its SDK explicitly rather than relying on flatpak-builder's auto-download.
- Linux gained `deb` and `tar.gz` builds alongside the AppImage. The AppImage needs `libfuse.so.2`, which Arch dropped for `fuse3` and which many minimal systems lack — a refused install pointing at a missing library. The `deb` is a real installer on Debian/Ubuntu/Mint and the `tar.gz` runs anywhere it is unpacked, so there is now a path for users who cannot run the AppImage at all.
- The update check now says what happened. The contract has always carried five states — checking, available, not-available, downloaded, error — but only two were ever emitted, so "you are on the newest release", "we could not reach the feed", and "no release exists yet" were all the same silence. A seller whose update check had been failing for a week had no way to notice, and none to tell that apart from already having the newest build. Every state is now emitted, `File → Check for Updates…` answers with a sentence naming the version you are on, and a failed check is reported as a warning rather than passing for good news.
- The update check is no longer a single attempt at launch. Launching offline is ordinary for a local-first app, and one failed check used to leave a seller on a stale build with no further attempt and no way to know. It now re-checks every six hours, and a failure carries the updater's own reason instead of being swallowed into a comment.
- macOS builds a `zip` alongside the DMG. electron-updater's macOS path applies a zip diff, so a build with no zip target has nothing to patch against and the macOS update feed could not work. The DMG is unchanged as the artifact a person downloads.
- `open-merchant-mcp` stopped reporting a version frozen at `1.0.0-alpha.0`, and its `bin` field pointed at a `dist/cli.js` that no longer exists — it was renamed to `cli.mjs` when the bundle was made self-contained, so the published command would have failed on a missing file. The end-to-end stdio test had the same defect baked in: it asserted the hardcoded `1.0.0-alpha.0`, pinning the bug it should have caught. It now compares against the package manifest, which is the invariant that actually matters.
- Every workspace package is versioned `1.0.0` together. They had drifted — the app on `beta.1` while every package stayed at `alpha.0` — which is how a build can tell a connector it is one thing and its own MCP server another.
- Packaging could ship the wrong MCP launcher. The staged `resources/mcp` folder is host-dependent state, and `dist` ran electron-builder directly — so anything that had staged for a different target first (a `--posix` staging run, a test that does the same) went straight into the installer. Caught by actually running `dist` and executing the packaged launcher, which produced a shell script where a `.cmd` belonged and did not run. `dist` now re-stages for its own target every time, so what lands in an installer is decided by the machine packaging it and not by leftover state.
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
