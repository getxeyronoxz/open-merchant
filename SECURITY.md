# Security Policy

## Supported versions

Security fixes are considered for the latest release built from the `dev`
branch (the active Open Merchant line). The `main` branch holds the archived
legacy implementation and does not receive updates.

## Reporting a vulnerability

Please use GitHub's **Private vulnerability reporting** feature for this
repository. Do not disclose suspected vulnerabilities through public issues,
discussions, or pull requests before a fix is available.

Include the affected version, clear reproduction steps, impact, and any
suggested mitigation. Reports will be acknowledged and handled privately
through the GitHub advisory.

## Dependency advisories

- Dependabot alerts are triaged against two rules:
  - **An upstream fix exists** → upgrade or override to the patched version and
    close the alert by fixing it (e.g. the `js-yaml` override in the root
    `package.json`).
  - **No upstream fix exists** (`first_patched_version: null`) → the alert is
    dismissed with a written justification recording exposure, blast radius,
    and mitigation. Build-only transitive dependencies that never reach runtime
    code or installers are never silently ignored.
- Where a security fix is needed before upstream releases it, the repository
  pins a local patch through `pnpm.patchedDependencies`; patches live under
  `patches/` and are reviewed like any other code change.

## Areas of particular interest

- Anything that could move API keys out of OS-backed encrypted storage
- Artifact reader path-traversal or symlink escapes beyond the known-layout guard
- Renderer isolation (contextIsolation/sandbox) or IPC contract bypasses
- Workspace file corruption or silent data recovery
