# Testing Open Merchant on each platform

CI runs the unit suite and the Electron end-to-end suite on Windows, macOS, and Ubuntu for every
push, so a platform-specific break fails before a user sees it. This page is about the things CI
**cannot** do: a real installed build, a real update, and a real desktop session.

## What CI covers, and what it does not

| | CI (all 3 OSes) | Needs a real machine |
| --- | --- | --- |
| Unit + integration suites | yes | — |
| Electron E2E against a dev build | yes | — |
| POSIX MCP launcher (fake `.app` and Linux trees) | yes | — |
| The staged launcher inside a **packaged** build | no | yes |
| Auto-update from a real GitHub Release | no | yes |
| A real desktop session, window chrome, menu bar | no | yes |

## Windows — verified here, re-runnable by you

Everything below runs on a Windows machine and is what the packaged-build checks used:

```bash
# 1. The gate
pnpm -r test && pnpm lint && pnpm typecheck
pnpm --filter @open-merchant/desktop test:e2e

# 2. A real build
pnpm build

# 3. A real installer layout, without a full installer
pnpm --filter @open-merchant/desktop dist

# 4. The bundled MCP server, executed from inside the packaged app
cd apps/desktop/release/win-unpacked/resources/mcp
cmd //c ".\\open-merchant-mcp.cmd --help"

# 5. The local update feed, against the real installed app
node apps/desktop/update-feed-server.cjs apps/desktop/release
# then launch the installed build with:
#   OPEN_MERCHANT_TEST_UPDATE_URL=http://localhost:8123/
```

Step 4 is the one that catches a whole class of bug: a build that packaged successfully and still
ships a launcher that cannot start. It caught a real one — a macOS shell script ending up in a
Windows installer.

## macOS — what to check on a real Mac

Not yet verified on macOS hardware. In order of what is most likely to be wrong:

1. **The app opens and the window renders.** The title bar is deliberately *not* overlaid on macOS
   (Windows only), so the window should have a normal frame.
2. **`File → Check for Updates…` answers something.** It now reports one of five states instead of
   silence. Which one you get tells you whether the feed was reachable at all.
3. **The MCP lane shows a real path.** On the Plugins screen, "Let your AI read the record" should
   offer a config pointing at
   `Open Merchant.app/Contents/Resources/mcp/open-merchant-mcp`. Run that command by hand — it
   should print the server's usage. If it does not, the launcher is not finding the app's runtime
   and the fallback is being used.
4. **A Gatekeeper warning on first launch is expected** until the build is notarised. See
   [platform notes](platform-notes.md).
5. **Auto-update.** Untested, and the `zip` target was added specifically so it can work — that
   change has not been exercised on a Mac. Until a release is tagged, there is nothing to update
   *to*, so "you are on the newest release" is the correct answer and proves nothing.

## Linux, including Arch

**Yes, Arch is a reasonable place to test this** — it is a good stress test, because it is a
rolling distribution with current libraries and no distribution-pinned workarounds. It is
*stricter* than Ubuntu, so anything that works there mostly works elsewhere.

```bash
# 1. Dependencies electron needs on a bare Arch install
sudo pacman -S --needed gdk-pixbuf2 libnotify nss libxss libxtst \
  xdg-utils at-spi2-core libsecret

# 2. Get the AppImage
chmod +x Open-Merchant-*-x86_64.AppImage
./Open-Merchant-*-x86_64.AppImage
```

### AppImage and FUSE — the first thing that will bite you

Arch moved to `fuse3` and dropped `fuse2` from the official repositories. AppImages are built
against `libfuse.so.2`, so a fresh Arch install reports a missing library and the AppImage refuses
to start. Two ways past it:

```bash
# A: install fuse2 from the AUR, then run normally
yay -S fuse2

# B: run without FUSE at all
./Open-Merchant-*.AppImage --appimage-extract-and-run
```

If you are packaging for Arch users, option A is what they will need, and it is worth saying so
in the Linux install notes.

### What to check once it is running

1. **The window opens and the walkthrough card shows.** The app's first-run state.
2. **Create a project and add a listing.** The E2E suite does this on Ubuntu, so it is a
   regression net, not a discovery tool — but doing it by hand catches what a test cannot assert.
3. **The Plugins screen shows the plugins directory.** On Linux that path is
   `~/.config/@open-merchant/desktop/plugins`. If the app shows a different one, trust the app.
4. **Run the sample connector.** Copy `examples/sample-connector` into that directory, enable it,
   and fetch. It needs `node` on `PATH`, because a connector is spawned as its own process — the
   bundled-runtime trick applies to *our* MCP server, not to third-party connectors.
5. **The MCP launcher.** `~/.local/share/open-merchant/resources/mcp/open-merchant-mcp --help`
   (the app shows the exact path). It should run without `node` installed.
6. **Auto-update: read the caveat.** A snap is confined to a *per-release* directory, so plugins
   and a stored API key can appear to vanish across an update. Test with the **AppImage**, not the
   snap, until that is fixed. See [platform notes](platform-notes.md).

## Auto-update: the thing that catches everyone

**A version bump is not a release.** The installed app updates from GitHub Releases, so a version
that has never been tagged has no release to come from and nothing to update to. Only the owner
pushes a `v*` tag.

When testing updates deliberately:

1. Tag and push a release, and let the workflow publish it.
2. Install the *previous* release from GitHub Releases — not your local build.
3. Launch it, then `File → Check for Updates…`.

The answer distinguishes three cases that used to be indistinguishable:

- *"You are on X, the newest release."* — the feed was reached; there is genuinely nothing newer.
- *"Could not check for updates: …"* — the feed was not reached. **This is not the same as being up
  to date**, and a warning is shown.
- *"A newer version is ready to install."* — it downloaded and will install on quit.
