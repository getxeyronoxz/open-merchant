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

const fetchProps = {
  query: "keyboard",
  onQueryChange: noop,
  onFetch: noop,
  fetchingPluginId: null,
} as const;

function render(plugins: InstalledPlugin[], extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    <PluginsPanel
      catalog={{ directory: "C:/app-data/plugins", plugins, broken: [] }}
      source={null}
      onSelect={noop}
      onToggle={noop}
      {...fetchProps}
      {...extra}
    />,
  );
}

function buttonTags(html: string): string[] {
  return html.match(/<button[^>]*>/gu) ?? [];
}

describe("PluginsPanel", () => {
  it("invites the seller to install a plugin when none exist", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ directory: "C:/app-data/plugins", plugins: [], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
        {...fetchProps}
      />,
    );

    expect(html).toContain("No plugins installed");
    expect(html).toContain("om-empty");
  });

  it("names each plugin with its id, version, author, and kind", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ directory: "C:/app-data/plugins", plugins: [SECTION_PLUGIN], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
        {...fetchProps}
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
        catalog={{ directory: "C:/app-data/plugins", plugins: [SECTION_PLUGIN, NETWORK_CONNECTOR], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
        {...fetchProps}
      />,
    );

    expect(html).toContain("Enable");
    expect(html).toContain("Disable");
  });

  it("discloses that a network connector may reach the internet", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ directory: "C:/app-data/plugins", plugins: [NETWORK_CONNECTOR], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
        {...fetchProps}
      />,
    );

    expect(html).toContain("may reach the internet");
  });

  it("does not claim a local plugin reaches the internet", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ directory: "C:/app-data/plugins", plugins: [SECTION_PLUGIN], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
        {...fetchProps}
      />,
    );

    expect(html).not.toContain("may reach the internet");
  });

  it("shows a plugin's source so it can be read before enabling", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ directory: "C:/app-data/plugins", plugins: [SECTION_PLUGIN], broken: [] }}
        source={{ pluginId: "report-risks", text: "## Watch MOQ" }}
        onSelect={noop}
        onToggle={noop}
        {...fetchProps}
      />,
    );

    expect(html).toContain("## Watch MOQ");
  });

  it("lists a broken plugin with the reason it was refused", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{
          directory: "C:/app-data/plugins",
          plugins: [],
          broken: [{ directoryName: "mystery", reason: "manifest.json is not valid JSON." }],
        }}
        source={null}
        onSelect={noop}
        onToggle={noop}
        {...fetchProps}
      />,
    );

    expect(html).toContain("mystery");
    expect(html).toContain("manifest.json is not valid JSON.");
  });
});

describe("PluginsPanel connector fetch", () => {
  it("offers Fetch on an enabled connector", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ directory: "C:/app-data/plugins", plugins: [NETWORK_CONNECTOR], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
        {...fetchProps}
      />,
    );

    expect(html).toContain("Fetch drafts");
  });

  it("does not offer Fetch on a connector the seller has not enabled", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ directory: "C:/app-data/plugins", plugins: [{ ...NETWORK_CONNECTOR, enabled: false, enabledAt: null }], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
        {...fetchProps}
      />,
    );

    expect(html).not.toContain("Fetch drafts");
  });

  it("never offers Fetch on a report-section plugin", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ directory: "C:/app-data/plugins", plugins: [{ ...SECTION_PLUGIN, enabled: true, enabledAt: "2026-09-25T00:00:00.000Z" }], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
        {...fetchProps}
      />,
    );

    expect(html).not.toContain("Fetch drafts");
  });

  it("says the fetch produces drafts, not a write to the project", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ directory: "C:/app-data/plugins", plugins: [NETWORK_CONNECTOR], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
        {...fetchProps}
      />,
    );

    expect(html).toContain("Draft Desk");
    expect(html).toMatch(/nothing is written to the project/iu);
  });

  it("takes a query, and refuses to fetch an empty one", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ directory: "C:/app-data/plugins", plugins: [NETWORK_CONNECTOR], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
        {...fetchProps}
        query="   "
      />,
    );

    expect(html).toContain("What should it look for?");
    expect(html).toContain("disabled");
  });

  it("marks the connector being fetched so the seller can see it is running", () => {
    const html = renderToStaticMarkup(
      <PluginsPanel
        catalog={{ directory: "C:/app-data/plugins", plugins: [NETWORK_CONNECTOR], broken: [] }}
        source={null}
        onSelect={noop}
        onToggle={noop}
        {...fetchProps}
        fetchingPluginId={NETWORK_CONNECTOR.manifest.id}
      />,
    );

    expect(html).toContain("Fetching…");
  });
});

describe("PluginsPanel row actions", () => {
  it("gives every action in a row a visible variant", () => {
    // `.om-button` on its own carries no background and a transparent border,
    // so a button with no `--` variant renders as bare text with padding around
    // it. Three actions in a row, one of them invisible, reads as a broken row.
    const buttons = buttonTags(render([NETWORK_CONNECTOR]));

    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const tag of buttons) {
      expect(tag).toMatch(/om-button--/u);
    }
  });

  it("distinguishes granting a plugin a capability from taking it away", () => {
    // Enabling is the affirmative act, and for a network connector it is a
    // disclosure the seller accepts. Disabling is the destructive direction.
    // The two directions of one toggle should not look like the same action.
    const enabled = render([NETWORK_CONNECTOR]).match(/<button[^>]*>[\s\S]*?<\/button>/gu) ?? [];
    const off = render([{ ...NETWORK_CONNECTOR, enabled: false, enabledAt: null }]);

    expect(enabled.some((tag) => /Disable/.test(tag) && /om-button--danger/u.test(tag))).toBe(true);
    expect(off).toMatch(/om-button--primary[^"]*"[^>]*>[\s\S]{0,80}?Enable/u);
  });
});

describe("PluginsPanel 'View source'", () => {
  const source = { pluginId: "price-connector", text: "export const run = () => {};" };

  it("reports the disclosure state instead of pretending to be a toggle", () => {
    // aria-pressed on a button that can only ever go true is a promise the
    // control cannot keep: clicking it again changed nothing at all. A
    // show/hide disclosure is aria-expanded, and that can be false.
    const closed = buttonTags(render([NETWORK_CONNECTOR], { source: null }));
    const open = buttonTags(render([NETWORK_CONNECTOR], { source }));

    expect(closed.some((tag) => tag.includes('aria-expanded="false"'))).toBe(true);
    expect(open.some((tag) => tag.includes('aria-expanded="true"'))).toBe(true);
    expect(closed.join(" ")).not.toContain("aria-pressed");
  });

  it("points the button at the source it reveals", () => {
    const html = render([NETWORK_CONNECTOR], { source });
    const controls = html.match(/aria-controls="([^"]+)"/u)?.[1];

    expect(controls).toBeTruthy();
    expect(html).toContain(`id="${controls}"`);
  });

  it("only marks the plugin whose source is showing as expanded", () => {
    // With two plugins installed, exactly one is the one being shown.
    const buttons = buttonTags(
      render([NETWORK_CONNECTOR, SECTION_PLUGIN], { source }),
    );

    expect(buttons.filter((tag) => tag.includes('aria-expanded="true"'))).toHaveLength(1);
  });
});
