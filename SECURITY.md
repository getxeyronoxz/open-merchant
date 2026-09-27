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

## Code scanning

CodeQL runs on every pull request and is expected to stay clean — an alert is
treated as a defect, not a backlog item. Two that arrived in 1.0.0 are worth
naming, because the response was to remove code rather than to suppress a rule:

- The MCP host-config helper generated a `claude mcp add …` one-liner through a
  shell-quoting function. CodeQL flagged a polynomial-time regular expression
  in it, and separately that the function did not escape backslashes. Both were
  real, and neither was worth repairing: quoting correct in Windows `cmd` is
  wrong in PowerShell and a no-op in `sh`, so no single escaper is correct, and
  an incomplete one hands a user a path that looks quoted and is not. The
  generator was removed. The JSON config — which has no quoting rules to get
  wrong — is the only thing the app emits now.

Suppressing a CodeQL rule is not an acceptable response on its own. If a rule
cannot be met, the finding gets recorded here with the reasoning, so the next
reader knows it was considered rather than missed.

## Areas of particular interest

- Anything that could move API keys out of OS-backed encrypted storage
- Artifact reader path-traversal or symlink escapes beyond the known-layout guard
- Renderer isolation (contextIsolation/sandbox) or IPC contract bypasses
- Workspace file corruption or silent data recovery
- The MCP lane: the server registers **no tools** and must keep registering none,
  and any read it performs is journaled. A change that gives it a write path is
  a security change, not a feature
- Connectors and plugins: a plugin is data and must never be imported as code;
  a connector is spawned with a scrubbed environment and must keep writing
  nothing to the project
- The update path: the feed is the project's own GitHub Releases, and a build
  that is not a tagged release must not be offered as an update
