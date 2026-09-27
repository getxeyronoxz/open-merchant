import type { InstalledPlugin, ReportSections } from "@open-merchant/shared";
import { describe, expect, it } from "vitest";

import { appendPluginSections } from "../src/plugin-sections";

const BASE: ReportSections = {
  decisionSummary: "Summary.",
  marketObservations: ["A market note."],
  risks: [],
  opportunities: [],
};

function sectionPlugin(
  id: string,
  section: "decisionSummary" | "marketObservations" | "risks" | "opportunities",
  markdown: string,
  enabled = true,
): InstalledPlugin {
  return {
    manifest: {
      id,
      name: id,
      version: "1.0.0",
      author: "A Seller",
      minAppVersion: "1.0.0",
      capabilities: { reads: [], writes: [], network: false },
      kind: "report-section",
      description: "A section.",
      section,
      markdown,
    },
    directory: `C:/plugins/${id}`,
    enabled,
    enabledAt: null,
  };
}

function connectorPlugin(): InstalledPlugin {
  return {
    manifest: {
      id: "price-connector",
      name: "Price connector",
      version: "1.0.0",
      author: "A Seller",
      minAppVersion: "1.0.0",
      capabilities: { reads: ["market"], writes: ["drafts"], network: true },
      kind: "connector",
      description: "Fetches prices.",
      toolName: "fetch_prices",
      command: "node",
      args: ["server.js"],
    },
    directory: "C:/plugins/price-connector",
    enabled: true,
    enabledAt: null,
  };
}

describe("appendPluginSections", () => {
  it("appends a plugin's markdown to its declared section", () => {
    const result = appendPluginSections(BASE, [sectionPlugin("risks-1", "risks", "## Watch MOQ")]);

    expect(result.risks).toEqual(["## Watch MOQ"]);
  });

  it("keeps existing entries and appends after them", () => {
    const result = appendPluginSections(
      { ...BASE, risks: ["Existing."] },
      [sectionPlugin("risks-1", "risks", "## Watch MOQ")],
    );

    expect(result.risks).toEqual(["Existing.", "## Watch MOQ"]);
  });

  it("appends to marketObservations without disturbing the other sections", () => {
    const result = appendPluginSections(BASE, [
      sectionPlugin("market-1", "marketObservations", "Prices fell."),
    ]);

    expect(result.marketObservations).toEqual(["A market note.", "Prices fell."]);
    expect(result.risks).toEqual([]);
  });

  it("appends to decisionSummary as a block rather than an array entry", () => {
    const result = appendPluginSections(BASE, [
      sectionPlugin("summary-1", "decisionSummary", "## Bottom line"),
    ]);

    expect(result.decisionSummary).toBe("Summary.\n\n## Bottom line");
    expect(result.risks).toEqual([]);
  });

  it("ignores disabled plugins", () => {
    const result = appendPluginSections(BASE, [
      sectionPlugin("risks-1", "risks", "## Watch MOQ", false),
    ]);

    expect(result.risks).toEqual([]);
  });

  it("ignores plugins of other kinds", () => {
    const result = appendPluginSections(BASE, [connectorPlugin()]);

    expect(result).toEqual(BASE);
  });

  it("returns the base unchanged when there are no plugins", () => {
    expect(appendPluginSections(BASE, [])).toEqual(BASE);
  });

  it("does not mutate the base it was given", () => {
    const base: ReportSections = { ...BASE, risks: [] };

    appendPluginSections(base, [sectionPlugin("risks-1", "risks", "## Watch MOQ")]);

    expect(base.risks).toEqual([]);
  });
});
