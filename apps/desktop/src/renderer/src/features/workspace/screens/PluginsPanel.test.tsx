import type { InstalledPlugin } from "@open-merchant/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PluginsPanel } from "./PluginsPanel";

const SECTION_PLUGIN: InstalledPlugin = {
  manifest: {
    id: "report-risks",
    name: "Risk boilerplate",
    version: "1.0.0",
    author: "A Seller",
    minAppVersion: "1.0.0",
    capabilities: { reads: [], writes: [], network: false },
    kind: "report-section",
    description: "Common failure modes.",
    section: "risks",
    markdown: "## Watch MOQ",
  },
  directory: "C:/plugins/report-risks",
  enabled: false,
  enabledAt: null,
};

const NETWORK_CONNECTOR: InstalledPlugin = {
  manifest: {
    id: "price-connector",
    name: "Price connector",
    version: "2.1.0",
    author: "A Seller",
    minAppVersion: "1.0.0",
    capabilities: { reads: ["market"], writes: ["drafts"], network: true },
    kind: "connector",
    description: "Fetches competitor prices.",
    toolName: "fetch_prices",
    command: "node",
    args: ["server.js"],
  },
  directory: "C:/plugins/price-connector",
  enabled: true,
  enabledAt: "2026-09-25T00:00:00.000Z",
};

const noop = () => undefined;

describe("PluginsPanel", () => {
  it("invites the seller to install a plugin when none exist", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel catalog={{ plugins: [], broken: [] }} source={null} onSelect={noop} onToggle={noop} />,
    );

    expect(html).toContain("No plugins installed");
    expect(html).toContain("om-empty");
  });

  it("names each plugin with its id, version, author, and kind", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ plugins: [SECTION_PLUGIN], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
      />,
    );

    expect(html).toContain("Risk boilerplate");
    expect(html).toContain("report-risks");
    expect(html).toContain("1.0.0");
    expect(html).toContain("A Seller");
    expect(html).toContain("report-section");
  });

  it("offers Enable for a disabled plugin and Disable for an enabled one", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ plugins: [SECTION_PLUGIN, NETWORK_CONNECTOR], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
      />,
    );

    expect(html).toContain("Enable");
    expect(html).toContain("Disable");
  });

  it("discloses that a network connector may reach the internet", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ plugins: [NETWORK_CONNECTOR], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
      />,
    );

    expect(html).toContain("may reach the internet");
  });

  it("does not claim a local plugin reaches the internet", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ plugins: [SECTION_PLUGIN], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
      />,
    );

    expect(html).not.toContain("may reach the internet");
  });

  it("shows a plugin's source so it can be read before enabling", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ plugins: [SECTION_PLUGIN], broken: [] }}
        source={{ pluginId: "report-risks", text: "## Watch MOQ" }}
        onSelect={noop}
        onToggle={noop}
      />,
    );

    expect(html).toContain("## Watch MOQ");
  });

  it("lists a broken plugin with the reason it was refused", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{
          plugins: [],
          broken: [{ directoryName: "mystery", reason: "manifest.json is not valid JSON." }],
        }}
        source={null}
        onSelect={noop}
        onToggle={noop}
      />,
    );

    expect(html).toContain("mystery");
    expect(html).toContain("manifest.json is not valid JSON.");
  });
});
