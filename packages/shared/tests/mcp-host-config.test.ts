import { describe, expect, it } from "vitest";

import { mcpHostConfig } from "../src/mcp-host-config";

/**
 * The snippet a seller pastes into their MCP host is the only thing standing
 * between them and the read-only lane. It has to be exactly what the host
 * expects, for the project they are actually looking at, and it must not be
 * buildable into something that escapes its own string.
 */

const command = "C:\\Program Files\\Open Merchant\\resources\\mcp\\open-merchant-mcp.cmd";
const root = "C:\\Users\\seller\\Documents\\Keyboards";

describe("mcpHostConfig", () => {
  it("names the server and the command to spawn", () => {
    const config = JSON.parse(mcpHostConfig(command, root)) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };

    expect(Object.keys(config.mcpServers)).toHaveLength(1);
    expect(Object.values(config.mcpServers)[0]?.command).toBe(command);
  });

  it("passes the project folder as an argument, so the host reads that project", () => {
    const config = JSON.parse(mcpHostConfig(command, root)) as {
      mcpServers: Record<string, { args: string[] }>;
    };

    expect(Object.values(config.mcpServers)[0]?.args).toEqual([root]);
  });

  it("survives a Windows path with backslashes and a space in it", () => {
    // The failure this guards: an unescaped backslash makes the snippet invalid
    // JSON, and the host reports a parse error the seller cannot act on.
    const parsed = JSON.parse(mcpHostConfig(command, root)) as {
      mcpServers: Record<string, { command: string }>;
    };

    expect(parsed.mcpServers["open-merchant"]?.command).toBe(command);
  });

  it("does not let a quote in a path break out into a second key", () => {
    const hostile = 'C:\\projects\\evil","evil":{"command":"calc.exe';
    const parsed = JSON.parse(mcpHostConfig(command, hostile)) as {
      mcpServers: Record<string, { args: string[] }>;
    };
    const entry = parsed.mcpServers["open-merchant"];

    // The injected text survives as an inert string inside args, which is
    // correct — what must not happen is it becoming structure. One key, one
    // argument, exactly the folder the seller picked.
    expect(Object.keys(parsed.mcpServers)).toEqual(["open-merchant"]);
    expect(entry?.args).toHaveLength(1);
    expect(entry?.args[0]).toBe(hostile);
    expect(Object.keys(entry ?? {})).toEqual(["command", "args"]);
  });

  it("is the shape an MCP host config actually expects", () => {
    // A top-level mcpServers map keyed by server name, with string command and
    // string args — the three things every stdio host reads.
    const parsed = JSON.parse(mcpHostConfig(command, root)) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual(["mcpServers"]);
    const entry = Object.values(parsed.mcpServers as Record<string, Record<string, unknown>>)[0];
    expect(typeof entry?.command).toBe("string");
    expect(Array.isArray(entry?.args)).toBe(true);
  });
});
