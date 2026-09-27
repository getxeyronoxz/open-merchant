# Open Merchant

![Open Merchant — make the call, with evidence in hand.](docs/media/og-banner.png)

<div align="center">

[![Release](https://img.shields.io/github/v/release/getxeyronoxz/open-merchant?label=release&color=blue)](https://github.com/getxeyronoxz/open-merchant/releases/latest)
[![License: AGPL-3.0](https://img.shields.io/github/license/getxeyronoxz/open-merchant?color=blue)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-555555?logo=electron&logoColor=white)](https://www.electron.build/)
[![MCP](https://img.shields.io/badge/MCP-read--only%20server-8A5CF5)](docs/mcp-hosts.md)
[![npm](https://img.shields.io/npm/v/open-merchant-mcp?label=npm&color=cb3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/open-merchant-mcp)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/codeql/codeql.yml?branch=dev&label=code%20scanning&color=green)](https://github.com/getxeyronoxz/open-merchant/actions)
[![CI](https://img.shields.io/github/actions/workflow/status/ci.yml?branch=dev&label=ci&color=green)](https://github.com/getxeyronoxz/open-merchant/actions)
[![Local-first](https://img.shields.io/badge/no%20cloud%20%7C%20no%20accounts%20%7C%20no%20telemetry-2EA44F)](https://github.com/getxeyronoxz/open-merchant)

</div>

A desktop workbench for deciding whether a product is worth pursuing, and for keeping the evidence
behind that decision.

Every decision gets its own folder on your own disk. Nothing is uploaded, nothing is locked in, and
nothing happens without you pressing the button. The arithmetic is done in exact decimals by tested
code — never by a language model, never by floating point. A language model can draft for you, but
it cannot write anything into your project until you accept it.

---

## Contents

- [Download](#download)
- [The loop](#the-loop)
- [A look inside](#a-look-inside)
- [Assistants](#assistants)
- [Letting your AI read the record](#letting-your-ai-read-the-record)
- [Plugins and connectors](#plugins-and-connectors)
- [Your project folder](#your-project-folder)
- [The arithmetic](#the-arithmetic)
- [Development](#development)
- [Where things are](#where-things-are)
- [Known limitations](#known-limitations)
- [Support](#support)
- [License](#license)

---

## Download

Latest release: **[v1.0.1](https://github.com/getxeyronoxz/open-merchant/releases/latest)** ·
[all releases](https://github.com/getxeyronoxz/open-merchant/releases) ·
[report an issue](https://github.com/getxeyronoxz/open-merchant/issues)

| Platform | Format | Get it |
| --- | --- | --- |
| **Windows** | `.exe` installer | [Releases](https://github.com/getxeyronoxz/open-merchant/releases/latest) |
| **macOS** | `.dmg` — Apple Silicon and Intel | [Releases](https://github.com/getxeyronoxz/open-merchant/releases/latest) |
| **Linux** | `.AppImage` — one file, no install | [Releases](https://github.com/getxeyronoxz/open-merchant/releases/latest) |
| | `.deb` — Debian, Ubuntu, Mint, Pop!_OS | [Releases](https://github.com/getxeyronoxz/open-merchant/releases/latest) |
| | `.tar.gz` — unpack and run anywhere | [Releases](https://github.com/getxeyronoxz/open-merchant/releases/latest) |
| | `snap` | [Releases](https://github.com/getxeyronoxz/open-merchant/releases/latest) |
| | `flatpak` — `flatpak install --user <file>` | [Releases](https://github.com/getxeyronoxz/open-merchant/releases/latest) |

Updates are automatic: the app checks this project's own Releases feed at launch and every six hours
after, downloads in the background, and applies the change when you quit. It never asks.

**If the AppImage refuses to start** with a missing `libfuse.so.2`, that is FUSE, not a bad download.
Install `fuse2` from the AUR, run it with `--appimage-extract-and-run`, or use the `.deb`.

<details>
<summary><b>Running the installers before CA signing</b></summary>

Open Merchant is an independent project and is not registered in Microsoft's or Apple's developer
registries — those cost money. Your operating system may therefore flag the installer on first launch.
The warning comes from the missing certificate, not from the software.

- **Windows** — SmartScreen may say *"Windows protected your PC"*. Choose **More info → Run anyway**.
  It may also say "unknown publisher"; installation proceeds either way.
- **macOS** — Gatekeeper blocks the first launch. Open **System Settings → Privacy & Security** and
  click **Open Anyway**, or right-click the app → **Open**. On Apple Silicon,
  `xattr -cr "/Applications/Open Merchant.app"` clears it in one step.
- **Linux** — nothing to do. `chmod +x` the AppImage and run it.

A CA-issued certificate is on the [roadmap](ROADMAP.md) and will remove these warnings on its own.
</details>

## The loop

Create a project. Write down what you want to know. Record the evidence. Compare what everyone else
is charging. Enter what it costs you. Calculate the margin. Write the report.

That is the whole product, and it is meant to be repeatable — for the next product, and the one after
that.

Around that loop sit a few things that turn out to matter more than expected:

- **Price history you can actually check.** Capture a snapshot of the market whenever you look. Over
  time you can answer "what did this listing cost the first time I saw it?" without guessing.
- **A margin monitor that watches for you.** Scenarios recompute against the newest snapshot, and the
  app flags it when market drift pushes a scenario past the threshold you set.
- **A decision journal.** Every report is a dated entry. Put two side by side, see what changed, and
  find out whether you would still make the call today.
- **A portfolio view.** Every project on one screen, worst margin first.
- **A standing attention queue.** Across every project: evidence that has gone stale, margins that
  drifted, work priced but never turned into a decision. Snoozing and dismissing are both on the
  record.
- **A restatement when the currency changes.** Enter the rate yourself — no network, no live feed —
  and every amount in the project is restated in exact decimals, after you have seen the
  before-and-after. Percentages stay percentages.
- **File-first, properly.** Spreadsheet import with row-by-row validation and stated reasons for
  rejected rows, CSV export, a printable report, and a single-file archive for backup.

## A look inside

![The full loop — create a project, add evidence and competitors, calculate exact unit economics, generate the opportunity report, then land on the Draft Desk where every draft waits for human acceptance — in about twenty-five seconds.](docs/media/demo-loop.gif)

| | |
|---|---|
| ![Unit economics with deterministic scenarios](docs/media/app-economics.png) | ![The generated report, on paper](docs/media/app-report.png) |
| *Unit economics — exact decimals, ledger-style rows* | *The opportunity report, rendered as a paper document* |

More views: [home](docs/media/app-home.png) · [objective](docs/media/app-objective.png) · [evidence](docs/media/app-evidence.png) · [competitors](docs/media/app-competitors.png) · [artifacts & history](docs/media/app-artifacts.png) · [the Draft Desk](docs/media/app-draft-desk.png)

## Assistants

Six specialists, all of them optional, all of them drafts. Bring your own key — Anthropic, OpenAI,
Google Gemini, or a local endpoint (Ollama, LM Studio, anything OpenAI-compatible) that needs no key
at all and never talks to a cloud. Cloud keys are sealed with your operating system's credential
storage and never appear in project folders, artifacts, or logs.

| Assistant | What it drafts |
| --- | --- |
| Research planner | A checklist of evidence to gather for your objective |
| Evidence assistant | Structured sources from material you paste in |
| Competitor analyst | Competitor listing entries from pasted listings |
| Economics reviewer | Sanity flags on your assumptions against market prices |
| Report writer | Decision summary, observations, risks, opportunities |
| Auditor | Whether your drafted claims are backed by recorded evidence |

A draft arrives marked as one. It becomes project data when you edit and save it, and then — and only
then — the run is journaled with the agent, provider, model, prompt hash, and a fingerprint of the
artifact. Assistants read what you paste into them. Nothing browses anything on its own.

Every draft from every source lands in one lane, the **Draft Desk**, which you can work through with
the arrow keys.

## Letting your AI read the record

Open Merchant ships a local, read-only MCP server, so an assistant can read a project's evidence,
competitors, snapshots, economics, and reports. It runs over stdio. There is no network socket in it,
nothing to authenticate, and nothing leaves your machine.

It cannot write. The server registers no tools at all, so a write attempt is refused at the protocol
level rather than by a check that could be bypassed. Every read appends one record to that project's
`runs.jsonl`, so an agent reading your folder leaves the same kind of trace you would.

It ships inside the app — **Plugins → "Let your AI read the record"** gives you the exact command and
a config to paste, and asks which host you use first, because hosts genuinely disagree. opencode
reads an `mcp` key with the transport spelled `local` and the command as an array; Claude Code and
Claude Desktop read `mcpServers` with `stdio`, a string command, and a separate `args`.

Or take it from npm, with no app involved at all:

```bash
npx --yes open-merchant-mcp /path/to/project
```

[`docs/mcp-hosts.md`](docs/mcp-hosts.md) has both formats, with the sources they came from.

## Plugins and connectors

A plugin is a folder of data, not code this app loads. Put one in the `plugins` directory and it
appears on the Plugins screen — disabled, with its declared source one click away, so nothing a
stranger wrote is turned on before you have read what it says it is.

| Platform | Plugins directory |
| --- | --- |
| Windows | `%APPDATA%\@open-merchant\desktop\plugins` |
| macOS | `~/Library/Application Support/@open-merchant/desktop/plugins` |
| Linux | `~/.config/@open-merchant/desktop/plugins` |

The screen shows you the exact path when the list is empty. Every plugin declares what it wants —
`reads`, `writes`, `network`, and the minimum app version it was written for. A plugin needing a
newer build than yours is refused and listed with the reason. Nothing is dropped silently.

`network: true` is a contract you accept, not a limit the app can enforce: Node cannot stop a spawned
process from opening a socket. The Plugins screen tells you which plugins ask for it.

A **connector** is the one kind that runs something — an external process speaking MCP over stdio. It
has to declare `writes: ["drafts"]`, and what it returns lands on the Draft Desk as drafts tagged with
its id and a hash of the raw response, never dressed up as something a model produced. A fetch writes
nothing to your project at all.

A runnable one is in [`examples/sample-connector`](examples/sample-connector): no dependencies, no
`npm install`, no network, returning clearly-marked sample listings. Copy the folder across to see the
whole path work.

## Your project folder

An ordinary directory you own and can read without this app:

```text
my-project/
  .openmerchant/
    manifest.json          # identity, objective, currency, schema version
    runs.jsonl             # meaningful operations (create, calculate, generate…)
    provenance.jsonl       # generated artifacts -> run, sha256, origin
  evidence/sources.jsonl   # your inputs
  market/competitors.json  # your inputs
  economics/assumptions.json
  economics/scenarios.json # generated
  reports/report-sections.json
  reports/opportunity-report.md # generated
```

Writes are atomic: an interrupted save leaves the previous file exactly as it was. A malformed file is
rejected loudly rather than quietly repaired — if something is wrong with your project, you are told
what, not handed a plausible-looking guess. Projects from schema version 1 can be brought forward with
**Import legacy project** on the Home screen.

## The arithmetic

Exact decimals, in tested code. Not a language model, not floating point. Rounding is
half-away-from-zero to two places, and only when a value is written out:

```text
marketplace fee = selling price × marketplace fee rate / 100
payment fee     = selling price × payment fee rate / 100
total cost      = acquisition + shipping + fees + other costs
gross profit    = selling price − total cost
gross margin    = gross profit / selling price × 100
```

Competitor statistics skip unpriced listings and report min, max, average, and median over the valid
prices only. The engine's output is pinned against golden fixtures carried over from the original
Rust implementation, so a refactor cannot quietly change a number you decided on.

## Development

Node.js 22+, pnpm 9+, Git.

```bash
pnpm install
pnpm dev        # run the app
pnpm test       # every package
pnpm lint
pnpm typecheck
```

CI runs the unit suite and the Electron end-to-end suite on Windows, macOS, and Ubuntu for every push.

The demo loop above — and the stills beside it — come from one scripted run against a real build:

```bash
pnpm build
pnpm --filter @open-merchant/desktop demo
```

`record.cjs` drives the app with Playwright and writes frames; `gif.mjs` assembles them with
`gifenc`, pure JavaScript, no ffmpeg and no network. The run ends on the Draft Desk, where the queue
is honestly empty because a capture run has no keys: what the frame shows is the gate, not a
fabricated result.

### Layout

```text
apps/desktop/      Electron app (main, preload, renderer), packaging, recorder
packages/shared/   Zod schemas: artifacts, IPC contract, errors, agent outputs
packages/core/     Domain engine: exact-decimal money, economics, statistics,
                   validation, report rendering, atomic workspace store, path
                   guards, journals, snapshots, margin monitor, decision journal,
                   CSV in/out, archives, print-to-PDF, V0 import
packages/ai/       Provider-agnostic model seam (Anthropic, OpenAI, Gemini,
                   local endpoints, mock) and the six specialists
packages/mcp/      Read-only MCP server, stdio only
packages/sdk/      Typed DesktopClient over the validated IPC contract, plus an
                   in-memory mock
packages/ui/       Design tokens and primitives ("The Merchant's Ledger")
examples/          Demo project, and a runnable sample connector
docs/              Architecture, platform notes, host configs, testing
```

The renderer never imports Electron. Everything crosses the one zod-validated IPC contract exposed
through `packages/sdk`.

## Where things are

- [`ROADMAP.md`](ROADMAP.md) — what has shipped and what is next
- [`docs/architecture.md`](docs/architecture.md) — how it is built, and the verification map
- [`docs/platform-notes.md`](docs/platform-notes.md) — what differs per platform, and what is still shaky
- [`docs/mcp-hosts.md`](docs/mcp-hosts.md) — connecting an assistant
- [`docs/testing-platforms.md`](docs/testing-platforms.md) — verifying a real build on each OS
- [`CHANGELOG.md`](CHANGELOG.md) — every release, in detail

## Known limitations

- No cloud sync, no accounts, no teams, no mobile app.
- Assistants cannot browse. You paste the page content in.
- Unaccepted drafts do not survive a restart. A draft is session-scoped; accepting it is what persists.
  Nothing in a project folder is ever lost.
- Installers are self-signed, so macOS and Windows warn you on first launch.
- A Linux **snap** keeps its data in a per-release directory, so plugins and a stored key can appear to
  vanish across an update. Prefer AppImage or flatpak until that is fixed.
- Not on Flathub yet.
- The example project ships with clearly-marked demo data, not live commercial claims.

## Support

If this is useful to you, the most useful things you can do, in order:

1. **Open an issue** if something breaks your workflow. That is the single highest-value thing you can
   give back, and it is worth more than a star.
2. **Answer someone else's issue.** A reproduction case or a question is real work saved.
3. **Star the repo** so other people can find it.
4. **Tell someone who decides things on price.** This is a desktop app for people who want their
   files, their exact numbers, and an assistant that waits to be told. That only spreads by word of
   mouth.

<p align="center">
  <a href="https://github.com/sponsors/xeyronox"><img alt="Sponsor" src="https://img.shields.io/badge/sponsor-%E2%9D%A4-ff69b4?style=for-the-badge&logo=github&logoColor=white" height="30"></a>
  <a href="https://github.com/getxeyronoxz/open-merchant/issues/new/choose"><img alt="Report an issue" src="https://img.shields.io/badge/report-an%20issue-ff5c5c?style=for-the-badge&logo=github&logoColor=white" height="30"></a>
  <a href="https://github.com/getxeyronoxz/open-merchant/stargazers"><img alt="Star the repo" src="https://img.shields.io/github/stars/getxeyronoxz/open-merchant?style=for-the-badge&logo=github&logoColor=white" height="30"></a>
  <a href="https://www.npmjs.com/package/open-merchant-mcp"><img alt="MCP server on npm" src="https://img.shields.io/npm/dm/open-merchant-mcp?style=for-the-badge&label=downloads&color=cb3837&logo=npm&logoColor=white" height="30"></a>
</p>

## License

[AGPL-3.0-only](LICENSE). Security reports: see [SECURITY.md](SECURITY.md).
