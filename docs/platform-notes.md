# Platform notes

Open Merchant builds and ships for Windows, macOS, and Linux from one matrix in
`.github/workflows/release.yml`. This page records the things that genuinely differ, and — just as
importantly — the ones that are known to be shaky and have not been fixed yet.

## What runs where

CI runs the full test suite **and the Electron end-to-end suite on Windows, macOS, and Ubuntu**
(`.github/workflows/ci.yml`). The same three build the installers on release. So a change that works
on one platform and not another fails CI rather than waiting to be noticed by a user.

| | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Installer | NSIS | DMG | AppImage, snap, flatpak |
| Signing | developer certificate (self-signed today) | Apple Developer ID + notarisation, when credentials are set | none |
| MCP launcher | `open-merchant-mcp.cmd` | `open-merchant-mcp` | `open-merchant-mcp` |
| Node required | no | no | no |

## The MCP launcher and the bundled Node runtime

The read-only MCP server ships inside the app as a single self-contained file. A host spawns it, so
each platform gets a launcher that can actually be spawned there:

- **Windows** gets a `.cmd`. A host cannot spawn a bare `.mjs` there at all, and the file carries
  CRLF because `cmd.exe` requires it.
- **macOS and Linux** get a `/bin/sh` script with LF endings, executable, staging a
  `#!/bin/sh` shebang. The bundle is a 1 MB file that has to survive being copied into a DMG, an
  AppImage, or a snap, and the launcher is the part that survives.

Both launchers prefer **the Node runtime that ships with Open Merchant** over anything on `PATH`,
using `ELECTRON_RUN_AS_NODE` to make the app's own binary behave as plain Node. This matters most on
macOS, where someone who installed a desktop application has often never installed Node and a
GUI-launched app has a minimal `PATH`.

Where the app's runtime is not where the launcher expects it — inside `Contents/MacOS` for a `.app`,
at the install root for everything else — the launcher falls back to `node` on `PATH`, and refuses
with a named cause if there is none or if it is older than Node 20. It prints the exact command
that works rather than a stack trace.

The macOS and Linux launchers are covered by `apps/desktop/tests/mcp-launcher.test.ts`, which builds
both a fake `.app` bundle and a fake Linux install tree and asserts the right executable is found in
each. The executable-bit assertion runs on POSIX only — NTFS has no bit to lose, so asserting it on
Windows would be asserting that `chmod` did something it structurally cannot.

Staging is per-platform: a macOS build carries only the shell launcher, a Windows build only the
`.cmd`. Packaging re-stages for its own target every time, so what goes into an installer is
decided by the machine doing the packaging and not by whatever was left in the directory from an
earlier run. Run `node apps/desktop/stage-mcp.cjs --posix` or `--windows` to stage for a specific target
regardless of the machine you are on, which is how the POSIX side is checked from Windows.

## Where your data lives

Plugin state, the recents list, and the sealed API keys live in Electron's `userData` directory.
On Windows and macOS that is a single stable path per user. **On Linux, the snap build is the
exception** — see below.

Your plugins go in a `plugins` folder inside that directory. The Plugins screen shows the exact
path when the list is empty, because it follows the package name and is not worth memorising.

## Installing on Linux

Four formats ship, and they are not interchangeable:

| Format | Needs FUSE? | Best for |
| --- | --- | --- |
| AppImage | **yes** (`libfuse.so.2`) | a single file, no install |
| `deb` | no | Debian, Ubuntu, Mint, Pop!_OS |
| `tar.gz` | no | anywhere — unpack and run |
| snap | no | anything with snapd |
| flatpak | no | anything with flatpak |

**If the AppImage refuses to start** with a missing `libfuse.so.2`, that is FUSE, not a broken
download. Arch dropped `fuse2` for `fuse3`; install `fuse2` from the AUR, or run the AppImage with
`--appimage-extract-and-run`. The `deb` and `tar.gz` builds sidestep it entirely.

## Flathub

The flatpak is built and published to the project's GitHub Releases, which makes it installable with
a direct download:

```bash
flatpak install --user <downloaded-flatpak-file>
```

**It is not on Flathub**, and that is the current state rather than an oversight. Putting an app on
Flathub is a separate submission to a third party: it is reviewed, it is versioned independently of
this repository, and it wants its own app id, screenshots, and a maintenance commitment. That is an
owner decision about an ongoing relationship, not a build flag.

What this project controls is that the flatpak is *buildable and installable* when it is:

- The runtime is a supported one. It was pinned to `23.08`, an end-of-life runtime from 2023 —
  Flathub keeps only supported runtimes in its main repository, so a flatpak built against one
  cannot be installed on a current system. It is now `26.08`, verified against the Flathub runtime
  list.
- CI installs that runtime and its SDK explicitly rather than relying on flatpak-builder's
  auto-download, so a mismatch fails the build with a clear message instead of producing an artifact
  nobody can install.

## Known-shaky, not yet fixed

**Snap and per-release data directories.** A strict-confinement snap is confined to
`~/snap/<name>/<revision>/`, which is scoped to the *installed revision*. A snap update moves the
app to a new revision, and anything the app stored in that directory — plugins, the recents list,
the sealed API key — can appear to vanish on update. The revision-independent
`~/snap/<name>/common/` is the right home for it, but moving an existing user's directory is a
migration that could strand a sealed API key, and this has not been tested on a real snap install.
**Until it is, treat the snap as the least-bad Linux package**, and prefer AppImage or flatpak if
you rely on plugins or a stored key. The fix is to point `userData` at the common directory and
migrate anything already there.

**Sandboxes and connectors.** A connector is a process this app spawns. Under snap or flatpak
confinement it runs inside the sandbox, so:

- `command: "node"` needs a Node visible *inside* the sandbox, which is not the same Node you have
  on your `PATH`.
- A connector that declares `network: true` is asking for a capability the sandbox may refuse. The
  Plugins screen discloses the declaration; the sandbox decides.
- A connector that reads a project folder outside your home directory will be denied without a
  matching permission.

None of this is a claim that connectors work under confinement — it is a list of what to check if
one does not.

**macOS Gatekeeper.** A DMG is only as trustworthy as its signature. The release workflow
notarises when `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` are set, and skips
signing cleanly when they are not — so an unnotarised build is what a first-time Mac user sees
today, and Gatekeeper will say so. Developer signing is Windows-only by nature
(`apps/desktop/dev-signing.ps1`); macOS uses the Apple credentials above.

## The example project and the demo

`examples/mechanical-keyboards-india` is plain JSON and JSONL, and `docs/media/demo-loop.gif` is
recorded on the build machine. Neither is platform-specific.
