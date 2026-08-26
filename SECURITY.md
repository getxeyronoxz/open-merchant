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

Areas of particular interest:

- Anything that could move API keys out of OS-backed encrypted storage
- Artifact reader path-traversal or symlink escapes beyond the known-layout guard
- Renderer isolation (contextIsolation/sandbox) or IPC contract bypasses
- Workspace file corruption or silent data recovery
