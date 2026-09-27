import { z } from "zod";

/**
 * MCP host configuration.
 *
 * The server itself is ordinary MCP over stdio, so any conforming host can
 * spawn it — the wire protocol is the same everywhere. What is *not* the same
 * is the config file syntax: hosts disagree on the top-level key, on whether
 * the command is a string or an array, and on whether the transport type is
 * spelled `stdio` or `local`. A snippet written for one host is simply not
 * read by another, so the app offers the formats it has verified rather than
 * one guess.
 *
 * Only formats verified against a host's own documentation are included. An
 * unverified format is worse than an absent one: it looks authoritative and
 * fails in a way the seller cannot diagnose.
 *
 * `JSON.stringify` builds every snippet. A hand-built string is how a Windows
 * path ends up with unescaped backslashes — invalid JSON, which a host reports
 * as a parse error the seller cannot act on.
 */

/** The name a host shows for this server; matches the server's own identity. */
export const MCP_HOST_CONFIG_NAME = "open-merchant";

export interface McpHostConfig {
  /** Stable id, safe to use as a key. */
  readonly id: string;
  /** What a seller would call this host. */
  readonly label: string;
  /** Where the snippet belongs, in words rather than as a path we would have to guess. */
  readonly fileHint: string;
  /**
   * The snippet, ready to paste. This is the whole payload on purpose.
   *
   * An earlier version also emitted a `claude mcp add …` one-liner, built by a
   * shell-quoting helper. It was removed rather than repaired: quoting that is
   * correct in `cmd` is wrong in PowerShell, and correct in POSIX `sh` does
   * nothing in `cmd` at all, so a single correct escaper does not exist. An
   * incomplete one is worse than none — a path that looks quoted and is not is
   * an injection the user pastes without reading. JSON is exact, portable, and
   * has no quoting rules to get wrong, so it is the only thing emitted. The
   * `claude mcp add` form is documented for people who prefer it, with the
   * user's own paths in it.
   */
  readonly snippet: string;
}

function claudeCode(command: string, projectRoot: string): McpHostConfig {
  return {
    id: "claude-code",
    label: "Claude Code or Claude Desktop",
    fileHint: "`.mcp.json` at your project root, or the Claude Desktop config",
    snippet: JSON.stringify(
      {
        mcpServers: {
          [MCP_HOST_CONFIG_NAME]: { type: "stdio", command, args: [projectRoot] },
        },
      },
      null,
      2,
    ),
  };
}

function opencode(command: string, projectRoot: string): McpHostConfig {
  return {
    id: "opencode",
    label: "opencode",
    // opencode wants a command *array* and spells the local transport `local`,
    // not `stdio`, and keys the map `mcp` rather than `mcpServers`.
    fileHint: "`opencode.jsonc`",
    snippet: JSON.stringify(
      {
        $schema: "https://opencode.ai/config.json",
        mcp: {
          [MCP_HOST_CONFIG_NAME]: {
            type: "local",
            command: [command, projectRoot],
            enabled: true,
          },
        },
      },
      null,
      2,
    ),
  };
}

/**
 * Every verified host format, in the order the app offers them.
 *
 * The command differs per platform, because the Windows entry is a `.cmd`
 * shim and everything else is the bundle itself.
 */
export function mcpHostConfigs(command: string, projectRoot: string): McpHostConfig[] {
  return [claudeCode(command, projectRoot), opencode(command, projectRoot)];
}

/** Wire shape of one host config, validated at the IPC boundary like everything else. */
export const mcpHostConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  fileHint: z.string().min(1),
  snippet: z.string().min(1),
});
