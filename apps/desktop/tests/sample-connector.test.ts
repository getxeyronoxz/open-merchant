import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MerchantService } from "../src/main/service";
import { PluginStore } from "../src/main/plugin-store";

/**
 * The sample connector, run for real.
 *
 * Every other connector test injects a fake client, which proves the app's
 * side of the contract and nothing about whether a real process can satisfy
 * it. This one spawns `examples/sample-connector` as an actual child process
 * and talks to it with the actual MCP client, so the dependency-free hand-
 * written server in that example is known to interoperate rather than assumed
 * to. It is also the only test that would notice the example drifting out of
 * step with the result schema it has to satisfy.
 */

const EXAMPLE = fileURLToPath(new URL("../../../examples/sample-connector/", import.meta.url));
const APP_VERSION = "1.0.0";

let userData: string;
let parent: string;
let service: MerchantService;
let root: string;
const dirs: string[] = [];

beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), "om-sample-ud-"));
  parent = await mkdtemp(join(tmpdir(), "om-sample-projects-"));
  dirs.push(userData, parent);

  // The plugin store is given the real app version, so the example's
  // `minAppVersion` is enforced here exactly as it is in a shipped build.
  service = new MerchantService(APP_VERSION, undefined, new PluginStore(userData, APP_VERSION));
  const created = await service.createProject({
    parentDirectory: parent,
    name: "Keyboards",
    objective: "Decide whether to enter the enthusiast keyboard market.",
    currency: "INR",
  });
  root = created.root;

  await cp(EXAMPLE, join(userData, "plugins", "sample-market"), { recursive: true });
  const store = new PluginStore(userData, APP_VERSION);
  await store.setEnabled("sample-market", true);
});

afterEach(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  dirs.length = 0;
});

describe("the shipped sample connector, run as a real process", () => {
  it("passes the minAppVersion gate a shipped build applies", async () => {
    const catalog = await new PluginStore(userData, APP_VERSION).list();

    expect(catalog.broken).toEqual([]);
    expect(catalog.plugins.map((plugin) => plugin.manifest.id)).toContain("sample-market");
  });

  it("is refused by a build older than the one it declares", async () => {
    // The gate is not decorative: the same folder must not load before 1.0.0.
    const catalog = await new PluginStore(userData, "1.0.0-alpha.4").list();

    expect(catalog.plugins).toHaveLength(0);
    expect(catalog.broken[0]?.reason).toContain("1.0.0");
  });

  it("produces evidence and competitor drafts over real MCP stdio", async () => {
    const { drafts } = await service.fetchFromConnector(
      root,
      "sample-market",
      "hot-swappable keyboard",
    );
    const kinds = drafts.map((draft) => draft.kind);

    // The sample returns one evidence record and two listings; both must come
    // back as drafts, because nothing a connector says becomes project data
    // without a human accepting it.
    expect(kinds.filter((kind) => kind === "evidence")).toHaveLength(1);
    expect(kinds.filter((kind) => kind === "competitors")).toHaveLength(1);
  });

  it("returns the seller's query inside the drafts, so a draft says where it came from", async () => {
    const { drafts } = await service.fetchFromConnector(root, "sample-market", "cherry mx");
    const evidence = drafts.find((draft) => draft.kind === "evidence");

    expect(JSON.stringify(evidence)).toContain("cherry mx");
  });

  it("stamps every draft with a connector origin and a response hash", async () => {
    const { drafts } = await service.fetchFromConnector(root, "sample-market", "keyboard");

    expect(drafts.length).toBeGreaterThan(0);
    for (const draft of drafts) {
      // Narrowed on purpose: an origin is a union, and a draft that arrives
      // dressed as an AI draft instead of a connector one is the exact failure
      // this lane exists to prevent.
      expect(draft.origin.kind).toBe("connector");
      if (draft.origin.kind !== "connector") continue;
      expect(draft.origin.connectorId).toBe("sample-market");
      expect(draft.origin.rawResponseHash).toMatch(/^[0-9a-f]{64}$/u);
    }
  });

  it("writes nothing to the project, and says only that it fetched", async () => {
    const before = await readFile(join(root, ".openmerchant", "runs.jsonl"), "utf8");
    const competitorsBefore = await readFile(join(root, "market", "competitors.json"), "utf8");

    await service.fetchFromConnector(root, "sample-market", "keyboard");

    const runs = (await readFile(join(root, ".openmerchant", "runs.jsonl"), "utf8"))
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    // The project gained exactly one run — the fetch — and nothing else.
    expect(runs.length).toBe(before.split("\n").filter((line) => line.trim() !== "").length + 1);
    expect(runs.at(-1)?.operation).toBe("connectorFetched");
    expect(await readFile(join(root, "market", "competitors.json"), "utf8")).toBe(competitorsBefore);
  });

  it("has no dependencies, so a copied folder runs anywhere Node does", async () => {
    // A sample that needed `npm install` before it worked would not be a sample
    // anyone could copy into their plugins folder.
    const source = await readFile(join(EXAMPLE, "server.mjs"), "utf8");
    expect(source).not.toMatch(/^\s*import .* from ["'][^.]/mu);
  });
});
