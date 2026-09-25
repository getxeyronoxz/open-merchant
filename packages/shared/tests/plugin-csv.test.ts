import { describe, expect, it } from "vitest";

import { applyCsvImporterPreset, csvImporterPresets } from "../src/plugin-csv";
import type { InstalledPlugin } from "../src/phase3";

function importerPlugin(
  id: string,
  mapping: Record<string, string>,
  enabled = true,
): InstalledPlugin {
  return {
    manifest: {
      id,
      name: `Importer ${id}`,
      version: "1.0.0",
      author: "A Seller",
      minAppVersion: "1.0.0",
      capabilities: { reads: ["csv"], writes: [], network: false },
      kind: "csv-importer",
      description: "Maps a supplier dialect.",
      mapping,
    },
    directory: `C:/plugins/${id}`,
    enabled,
    enabledAt: null,
  };
}

function sectionPlugin(): InstalledPlugin {
  return {
    manifest: {
      id: "risk-checklist",
      name: "Risk checklist",
      version: "1.0.0",
      author: "A Seller",
      minAppVersion: "1.0.0",
      capabilities: { reads: [], writes: [], network: false },
      kind: "report-section",
      description: "A checklist.",
      section: "risks",
      markdown: "## Risks",
    },
    directory: "C:/plugins/risk-checklist",
    enabled: true,
    enabledAt: null,
  };
}

describe("csvImporterPresets", () => {
  it("offers enabled csv-importer plugins and nothing else", () => {
    const presets = csvImporterPresets([
      importerPlugin("supplier-x", { product: "Item" }),
      sectionPlugin(),
    ]);

    expect(presets).toEqual([
      { id: "supplier-x", name: "Importer supplier-x", mapping: { product: "Item" } },
    ]);
  });

  it("leaves out disabled importer plugins", () => {
    expect(csvImporterPresets([importerPlugin("supplier-x", { product: "Item" }, false)])).toEqual(
      [],
    );
  });
});

describe("applyCsvImporterPreset", () => {
  it("maps canonical fields to the headers the preset names", () => {
    expect(
      applyCsvImporterPreset({ product: "Item", price: "Unit Price" }, ["Item", "Unit Price", "Notes"]),
    ).toEqual({ product: "Item", price: "Unit Price" });
  });

  it("drops a preset entry whose column is not in the file", () => {
    expect(applyCsvImporterPreset({ product: "Item", price: "Unit Price" }, ["Item", "Notes"])).toEqual(
      { product: "Item" },
    );
  });

  it("drops an entry naming a field this importer does not understand", () => {
    expect(applyCsvImporterPreset({ product: "Item", nonsense: "Whatever" }, ["Item", "Whatever"])).toEqual(
      { product: "Item" },
    );
  });

  it("returns an empty mapping when the file shares no columns with the preset", () => {
    expect(applyCsvImporterPreset({ product: "Item" }, ["Something else"])).toEqual({});
  });

  it("ignores a preset that maps no product column, so import stays blocked", () => {
    expect(applyCsvImporterPreset({ price: "Unit Price" }, ["Unit Price"]).product).toBeUndefined();
  });
});
