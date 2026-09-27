import { describe, expect, it } from "vitest";

import { mcpHostConfigs } from "../src/mcp-host-config";

/**
 * The snippet a seller pastes is the only thing between them and the read-only
 * lane. Two things have to be true: it must be exactly what their host reads,
 * and it must survive a Windows path with backslashes and spaces in it.
 *
 * The formats here were taken from each host's own documentation rather than
 * from what looks consistent, because they genuinely disagree — different key
 * names, different transport spellings, and command-as-array vs command-as-
 * string. A snippet written for one host is not read by another.
 */

const command = "C:\\Program Files\\Open Merchant\\resources\\mcp\\open-merchant-mcp.cmd";
const root = "C:\\Users\\seller\\Documents\\Keyboards";

function host(id: string, spawnCommand = command, projectRoot = root) {
  const found = mcpHostConfigs(spawnCommand, projectRoot).find((entry) => entry.id === id);
  expect(found, `no config for host "${id}"`).toBeTruthy();
  return found as ReturnType<typeof mcpHostConfigs>[number];
}

describe("mcpHostConfigs", () => {
  it("offers more than one format, because hosts do not agree on one", () => {
    // A single snippet is a guess. The whole point of the registry is that the
    // seller picks the host they actually run.
    const hosts = mcpHostConfigs(command, root);
    expect(hosts.length).toBeGreaterThan(1);
    expect(new Set(hosts.map((entry) => entry.label)).size).toBe(hosts.length);
  });

  it("names where each snippet belongs, in words rather than a guessed path", () => {
    for (const entry of mcpHostConfigs(command, root)) {
      expect(entry.fileHint.length).toBeGreaterThan(0);
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  describe("the mcpServers format, as Claude Code and Claude Desktop read it", () => {
    it("keys the map mcpServers and names the transport stdio", () => {
      const parsed = JSON.parse(host("claude-code").snippet) as {
        mcpServers: Record<string, { type: string; command: string; args: string[] }>;
      };

      expect(Object.keys(parsed)).toEqual(["mcpServers"]);
      expect(parsed.mcpServers["open-merchant"]?.type).toBe("stdio");
      expect(parsed.mcpServers["open-merchant"]?.command).toBe(command);
      expect(parsed.mcpServers["open-merchant"]?.args).toEqual([root]);
    });

  });

  describe("the opencode format", () => {
    it("keys the map mcp, not mcpServers", () => {
      // This is the difference that made the single-snippet approach wrong:
      // opencode does not read a `mcpServers` key at all.
      const parsed = JSON.parse(host("opencode").snippet) as Record<string, unknown>;

      expect(Object.keys(parsed)).toContain("mcp");
      expect(Object.keys(parsed)).not.toContain("mcpServers");
    });

    it("spells the local transport `local`, not `stdio`", () => {
      const parsed = JSON.parse(host("opencode").snippet) as {
        mcp: Record<string, { type: string }>;
      };

      expect(parsed.mcp["open-merchant"]?.type).toBe("local");
    });

    it("wants the command as an array, with the project as its argument", () => {
      const parsed = JSON.parse(host("opencode").snippet) as {
        mcp: Record<string, { command: string[]; enabled: boolean }>;
      };
      const entry = parsed.mcp["open-merchant"];

      expect(Array.isArray(entry?.command)).toBe(true);
      expect(entry?.command).toEqual([command, root]);
      expect(entry?.enabled).toBe(true);
    });

    it("carries the schema hint opencode's editor completion uses", () => {
      expect(JSON.parse(host("opencode").snippet).$schema).toBe("https://opencode.ai/config.json");
    });
  });

  it("emits no shell command line, because no quoting is correct everywhere", () => {
    // There was a `claude mcp add …` one-liner here, built by a quoting helper.
    // It is gone deliberately: quoting correct in cmd is wrong in PowerShell,
    // and correct in POSIX sh does nothing in cmd, so a single correct escaper
    // does not exist. An incomplete one hands the user a path that looks
    // quoted and is not.
    for (const entry of mcpHostConfigs(command, root)) {
      expect(Object.keys(entry)).toEqual(["id", "label", "fileHint", "snippet"]);
    }
  });

  it("survives a Windows path with backslashes and a space in it", () => {
    // Unescaped backslashes make the snippet invalid JSON, and a host reports
    // that as a parse error the seller cannot act on.
    for (const entry of mcpHostConfigs(command, root)) {
      expect(() => JSON.parse(entry.snippet)).not.toThrow();
      expect(entry.snippet).toContain("Program Files");
    }
  });

  it("does not let a quote in a project path break out into a second key", () => {
    const hostile = 'C:\\projects\\evil","evil":{"command":"calc.exe';

    for (const entry of mcpHostConfigs(command, hostile)) {
      const parsed = JSON.parse(entry.snippet) as Record<string, Record<string, unknown>>;
      const map = (parsed.mcpServers ?? parsed.mcp) as Record<string, unknown>;

      expect(Object.keys(map)).toEqual(["open-merchant"]);
      expect(Object.keys(map["open-merchant"] ?? {})).toHaveLength(
        entry.id === "opencode" ? 3 : 3,
      );
    }
  });
});
