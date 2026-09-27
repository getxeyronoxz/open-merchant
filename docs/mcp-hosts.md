# Connecting Open Merchant to an MCP host

Open Merchant ships a **local, read-only MCP server**. Any MCP host that can spawn a stdio
server can run it — there is no network socket, nothing to authenticate, and nothing leaves your
machine.

The app hands you the exact config: **Plugins → "Let your AI read the record"**. Pick your host
there and copy the snippet. This page exists so the formats are written down and you can see what
each host actually expects.

## What the server can and cannot do

| | |
| --- | --- |
| Read | objective, evidence, competitors, market snapshots, economics, reports, run and provenance journals |
| Write | **nothing** — the server registers no tools, so a write attempt is refused at the protocol level |
| Transport | stdio only. There is no network socket in the package. |
| On the record | every read appends one `mcpArtifactRead` run to that project's `runs.jsonl` |

Point it at **one project folder**. The server serves that folder and nothing else.

## Where the server comes from

Two routes, same binary:

- **In the app.** A published install always includes it, and the Plugins screen shows the exact
  path and a config to paste. This is the easy route and needs no Node of your own.
- **On npm.** `@open-merchant/mcp` is a single self-contained file with no runtime dependencies:

  ```bash
  npx --yes @open-merchant/mcp /path/to/project
  ```

  Useful when the server has to follow a project the app does not own, or when you would rather not
  install the app at all. It does need a `node` on your `PATH` (20 or newer); the copy inside the app
  does not.

## The two formats, and why they differ

The wire protocol is identical everywhere. The *config file* is not: hosts disagree on the
top-level key, on the transport spelling, and on whether the command is a string or an array. A
snippet written for one host is simply not read by another, which is why the app asks which host
you use instead of guessing.

### Claude Code / Claude Desktop — `mcpServers`, transport `stdio`

```json
{
  "mcpServers": {
    "open-merchant": {
      "type": "stdio",
      "command": "<the path the app shows>",
      "args": ["<your project folder>"]
    }
  }
}
```

Goes in `.mcp.json` at your project root, or in the Claude Desktop config. Claude Code also
registers it without editing a file:

```bash
claude mcp add --transport stdio open-merchant -- "<path>" "<project folder>"
```

Check it with `claude mcp get open-merchant`.

**The app does not generate that line for you, and that is deliberate.** Quoting that is correct in
Windows `cmd` is wrong in PowerShell, and correct in a POSIX shell does nothing in `cmd` at all —
so there is no single correct escaper, and an incomplete one hands you a path that looks quoted and
is not. Type it yourself with your own paths, or use the JSON above, which has no quoting rules to
get wrong.

### opencode — `mcp`, transport `local`, command as an array

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "open-merchant": {
      "type": "local",
      "command": ["<the path the app shows>", "<your project folder>"],
      "enabled": true
    }
  }
}
```

Goes in `opencode.jsonc`. Note the three differences from the form above: the key is `mcp` rather
than `mcpServers`, the transport is spelled `local` rather than `stdio`, and `command` is an array
holding the program and the project folder together — there is no separate `args` key.

## Other hosts

They speak the same protocol, so the server works with them — but each names its settings
differently, and this project does not publish snippets it has not verified against a host's own
documentation. An unverified snippet looks authoritative and fails in a way that is hard to
diagnose, so it is not included.

What every stdio host needs is two things: **the command** (the path the app shows you) and **the
project folder as its first argument**. Find your host's MCP configuration page, and give it
those.

## Running the server without the app's help

On Windows the app stages a `.cmd` that runs the server through the Node runtime that ships with
Open Merchant, so you do not need Node installed. On macOS and Linux the staged file is the server
itself and needs a `node` on your `PATH`.

A development checkout does not stage the server. To point a dev build at one:

```bash
OPEN_MERCHANT_MCP_COMMAND=/path/to/packages/mcp/dist/cli.mjs pnpm dev
```

## Sources

- [Claude Code — MCP](https://code.claude.com/docs/en/mcp)
- [opencode — MCP servers](https://opencode.ai/docs/mcp-servers/)
