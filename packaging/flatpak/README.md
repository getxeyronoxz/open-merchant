# Flathub submission

Everything Flathub needs from this repository, kept here so it is versioned and reviewable next to
the code. The submission itself is a pull request against a **fork of `flathub/flathub`**, not
against this repository.

## What is here, and what is not

| File | State |
| --- | --- |
| `com.xeyronox.openmerchant.metainfo.xml` | written, **not validated by `flatpak-builder-lint`** — needs Linux |
| `data/screenshots/*.png` | four, 1600×1000, taken from a real 1.0.0 run |
| `data/icons/` | **empty** — see below |
| `LICENSE` | copy `AGPL-3.0-only` from the repository root |
| a build manifest | **not written** — see below |

Two things are genuinely unfinished, and both are called out rather than faked.

### The icons

Flathub requires `128×128` and `256×256` icons. This repository has a single 1024×1024
`apps/desktop/build/icon.png`, which needs downscaling — normally with `flatpak-builder` or
`icoutils`. Doing that by hand on Windows would mean shipping an icon nobody has looked at.

### The build manifest

This is the real gap. electron-builder already produces a working, installable flatpak — the CI
release run for v1.0.0 built and uploaded `Open-Merchant-1.0.0-x86_64.flatpak` successfully — but
it generates that flatpak internally and does not leave a manifest in the repository.

Flathub wants a **reproducible source build**: a manifest that clones this repository at a tag,
builds the app, and installs it, so a reviewer can rebuild it. That manifest would need a Node and
pnpm toolchain inside the sandbox and a build step, and it could not be tested on a Windows machine.

Writing it untested would mean shipping a submission that fails review on its first build. That is
worse than not submitting yet.

## Before submitting: the Generative AI policy

Flathub's submission page says plainly: *"Please see the Generative AI policy before submitting."*

This is not a formality for this app. Its headline features are six AI assistants and an MCP server
that exists so an assistant can read your project. Whether that meets the policy is a judgement
about the product, and it belongs to the owner, not to a code review.

## The steps, once the manifest exists

```bash
flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install -y flathub org.flatpak.Builder

# Build and install locally
flatpak run --command=flathub-build org.flatpak.Builder --install <manifest>

# Lint, which should pass before anything is submitted
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest <manifest>
flatpak run --command=flatpak-builder-lint org.flatpak.Builder repo repo
```

Then fork `flathub/flathub` (**leave "Copy the master branch only" unchecked**), branch from
`new-pr`, add the files under your app id, and open a pull request **against `new-pr`**, not
`master`. The title should be `Add com.xeyronox.openmerchant`.

```bash
gh repo fork --clone flathub/flathub && cd flathub && git checkout --track origin/new-pr
git checkout -b my-app-submission new-pr
# add files, commit, push, then open the PR against the new-pr base
```

Submissions can be rejected at any stage, or recalled after merge, if the app is later found not to
be suitable.
