import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PluginStore } from "../src/main/plugin-store";

const VALID_CONNECTOR = {
  id: "price-connector",
  name: "Price connector",
  version: "1.0.0",
  author: "A Seller",
  minAppVersion: "1.0.0",
  capabilities: { reads: ["market"], writes: ["drafts"], network: true },
  kind: "connector",
  description: "Fetches competitor prices.",
  toolName: "fetch_prices",
  command: "node",
  args: ["server.js"],
};

const VALID_SECTION = {
  id: "report-risks",
  name: "Risk boilerplate",
  version: "1.0.0",
  author: "A Seller",
  minAppVersion: "1.0.0",
  capabilities: { reads: [], writes: [], network: false },
  kind: "report-section",
  description: "Common failure modes.",
  section: "risks",
  markdown: "## Common failure modes\nConfirm supplier MOQ.",
};

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "om-plugins-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writePlugin(name: string, manifest: unknown): Promise<void> {
  const pluginDir = join(dir, "plugins", name);
  await mkdir(pluginDir, { recursive: true });
  await writeFile(join(pluginDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

/** Asserts there is exactly one entry and hands it back, so a test can never read `undefined`. */
function only<T>(items: T[]): T {
  expect(items).toHaveLength(1);
  return items[0] as T;
}

describe("PluginStore.list", () => {
  it("discovers a valid connector and a valid report section", async () => {
    await writePlugin("price-connector", VALID_CONNECTOR);
    await writePlugin("report-risks", VALID_SECTION);

    const catalog = await new PluginStore(dir).list();

    expect(catalog.broken).toEqual([]);
    expect(catalog.plugins.map((plugin) => plugin.manifest.id).sort()).toEqual([
      "price-connector",
      "report-risks",
    ]);
  });

  it("loads every plugin disabled by default", async () => {
    await writePlugin("report-risks", VALID_SECTION);

    const catalog = await new PluginStore(dir).list();

    expect(only(catalog.plugins).enabled).toBe(false);
    expect(only(catalog.plugins).enabledAt).toBeNull();
  });

  it("refuses a manifest with no author and reports the reason", async () => {
    const { author: _omitted, ...withoutAuthor } = VALID_SECTION;
    await writePlugin("report-risks", withoutAuthor);

    const catalog = await new PluginStore(dir).list();

    expect(catalog.plugins).toEqual([]);
    const broken = only(catalog.broken);
    expect(broken.directoryName).toBe("report-risks");
    expect(broken.reason).toMatch(/author/i);
  });

  it("refuses a manifest whose directory name differs from its id", async () => {
    await writePlugin("mismatched-folder", VALID_SECTION);

    const catalog = await new PluginStore(dir).list();

    expect(catalog.plugins).toEqual([]);
    expect(only(catalog.broken).reason).toMatch(/directory name/i);
  });

  it("reports two plugins claiming the same id as broken rather than picking one", async () => {
    const { id: _first, ...first } = VALID_SECTION;
    const { id: _second, ...second } = VALID_SECTION;
    await writePlugin("report-risks", { ...first, id: "report-risks" });
    await writePlugin("copy-of-risks", { ...second, id: "report-risks" });

    const catalog = await new PluginStore(dir).list();

    expect(catalog.plugins).toEqual([]);
    expect(catalog.broken).toHaveLength(2);
    expect(catalog.broken.some((entry) => entry.reason.match(/duplicate/i))).toBe(true);
  });

  it("returns an empty catalog when the plugins folder does not exist", async () => {
    const catalog = await new PluginStore(dir).list();

    expect(catalog).toEqual({ plugins: [], broken: [] });
  });
});

describe("PluginStore.setEnabled", () => {
  it("persists enabled state across store instances", async () => {
    await writePlugin("report-risks", VALID_SECTION);

    await new PluginStore(dir).setEnabled("report-risks", true);
    const catalog = await new PluginStore(dir).list();

    expect(only(catalog.plugins).enabled).toBe(true);
    expect(only(catalog.plugins).enabledAt).not.toBeNull();
  });

  it("disables a previously enabled plugin and clears the timestamp", async () => {
    await writePlugin("report-risks", VALID_SECTION);
    const store = new PluginStore(dir);
    await store.setEnabled("report-risks", true);

    const updated = await store.setEnabled("report-risks", false);

    expect(updated.enabled).toBe(false);
    expect(updated.enabledAt).toBeNull();
  });

  it("leaves other plugins' state untouched", async () => {
    await writePlugin("report-risks", VALID_SECTION);
    await writePlugin("price-connector", VALID_CONNECTOR);
    const store = new PluginStore(dir);

    await store.setEnabled("report-risks", true);
    const catalog = await store.list();

    expect(only(catalog.plugins.filter((plugin) => plugin.manifest.id === "price-connector")).enabled).toBe(
      false,
    );
  });

  it("throws for an unknown plugin id", async () => {
    await expect(new PluginStore(dir).setEnabled("nope", true)).rejects.toThrow(/nope/);
  });

  it("treats a corrupt state file as everything disabled", async () => {
    await writePlugin("report-risks", VALID_SECTION);
    await writeFile(join(dir, "plugin-state.json"), "{ not json", "utf8");

    const catalog = await new PluginStore(dir).list();

    expect(only(catalog.plugins).enabled).toBe(false);
  });
});

describe("PluginStore.readSource", () => {
  it("returns the markdown for a report-section plugin", async () => {
    await writePlugin("report-risks", VALID_SECTION);

    expect(await new PluginStore(dir).readSource("report-risks")).toContain("Confirm supplier MOQ.");
  });

  it("returns the mapping as JSON for a csv-importer plugin", async () => {
    await writePlugin("supplier-x", {
      id: "supplier-x",
      name: "Supplier X dialect",
      version: "1.0.0",
      author: "A Seller",
      minAppVersion: "1.0.0",
      capabilities: { reads: ["csv"], writes: [], network: false },
      kind: "csv-importer",
      description: "Maps Supplier X's export.",
      mapping: { name: "Product", price: "Unit Price" },
    });

    const source = await new PluginStore(dir).readSource("supplier-x");

    expect(JSON.parse(source)).toEqual({ name: "Product", price: "Unit Price" });
  });

  it("returns the command and args for a connector plugin", async () => {
    await writePlugin("price-connector", VALID_CONNECTOR);

    const source = await new PluginStore(dir).readSource("price-connector");

    expect(source).toContain("command: node");
    expect(source).toContain("args: server.js");
  });

  it("throws for an unknown plugin id", async () => {
    await expect(new PluginStore(dir).readSource("nope")).rejects.toThrow(/nope/);
  });
});

describe("PluginStore state-file robustness", () => {
  it("treats a state file whose enabled flag is not a boolean as everything disabled", async () => {
    await writePlugin("report-risks", VALID_SECTION);
    await writeFile(
      join(dir, "plugin-state.json"),
      JSON.stringify({ plugins: { "report-risks": { enabled: "yes", enabledAt: null } } }),
      "utf8",
    );

    const catalog = await new PluginStore(dir).list();

    expect(only(catalog.plugins).enabled).toBe(false);
    expect(only(catalog.plugins).enabledAt).toBeNull();
  });

  it("treats a state file with a malformed timestamp as everything disabled", async () => {
    await writePlugin("report-risks", VALID_SECTION);
    await writeFile(
      join(dir, "plugin-state.json"),
      JSON.stringify({ plugins: { "report-risks": { enabled: true, enabledAt: "yesterday" } } }),
      "utf8",
    );

    const catalog = await new PluginStore(dir).list();

    expect(only(catalog.plugins).enabled).toBe(false);
  });

  it("keeps good entries and drops only the malformed ones", async () => {
    await writePlugin("report-risks", VALID_SECTION);
    await writePlugin("price-connector", VALID_CONNECTOR);
    await writeFile(
      join(dir, "plugin-state.json"),
      JSON.stringify({
        plugins: {
          "report-risks": { enabled: "yes", enabledAt: null },
          "price-connector": { enabled: true, enabledAt: "2026-09-25T00:00:00.000Z" },
        },
      }),
      "utf8",
    );

    const catalog = await new PluginStore(dir).list();
    const byId = new Map(catalog.plugins.map((plugin) => [plugin.manifest.id, plugin]));

    expect(byId.get("report-risks")?.enabled).toBe(false);
    expect(byId.get("price-connector")?.enabled).toBe(true);
  });

  it("treats a state file that is valid JSON of the wrong shape as everything disabled", async () => {
    await writePlugin("report-risks", VALID_SECTION);
    await writeFile(join(dir, "plugin-state.json"), JSON.stringify(["not", "an", "object"]), "utf8");

    const catalog = await new PluginStore(dir).list();

    expect(only(catalog.plugins).enabled).toBe(false);
  });
});

describe("PluginStore discovery of unusual directories", () => {
  it("refuses a symlinked plugin folder instead of silently skipping it", async () => {
    const real = join(dir, "elsewhere", "report-risks");
    await mkdir(real, { recursive: true });
    await writeFile(join(real, "manifest.json"), JSON.stringify(VALID_SECTION), "utf8");
    await mkdir(join(dir, "plugins"), { recursive: true });
    await symlink(join(dir, "elsewhere", "report-risks"), join(dir, "plugins", "linked"), "junction");

    const catalog = await new PluginStore(dir).list();

    expect(catalog.plugins).toEqual([]);
    const broken = only(catalog.broken);
    expect(broken.directoryName).toBe("linked");
    expect(broken.reason).toMatch(/symbolic link|symlink/i);
  });
});
