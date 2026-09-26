import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { GenerationOrigin } from "@open-merchant/shared";

import { DraftOriginPanel } from "./DraftOriginPanel";

const AI_ORIGIN: GenerationOrigin = {
  kind: "agent",
  agentId: "planner",
  providerId: "anthropic",
  modelId: "claude",
  promptHash: "a".repeat(64),
};

const CONNECTOR_ORIGIN: GenerationOrigin = {
  kind: "connector",
  connectorId: "sample-market",
  pluginId: "sample-market",
  fetchedAt: "2026-09-25T00:00:00.000Z",
  rawResponseHash: "b".repeat(64),
};

describe("DraftOriginPanel", () => {
  it("shows agent, model and prompt hash for an AI draft", () => {
    const html = renderToStaticMarkup(<DraftOriginPanel origin={AI_ORIGIN} />);

    expect(html).toContain("planner");
    expect(html).toContain("Prompt hash");
    expect(html).not.toContain("Raw response hash");
  });

  it("shows connector, plugin, fetch time and raw hash for a connector draft", () => {
    const html = renderToStaticMarkup(<DraftOriginPanel origin={CONNECTOR_ORIGIN} />);

    expect(html).toContain("sample-market");
    expect(html).toContain("Fetched at");
    expect(html).toContain("Raw response hash");
    expect(html).not.toContain("Prompt hash");
  });

  it("does not claim a connector draft came from a model", () => {
    const html = renderToStaticMarkup(<DraftOriginPanel origin={CONNECTOR_ORIGIN} />);

    expect(html).not.toContain("Provider / model");
  });

  it("credits a hand-written draft to the person, not to a plugin or a model", () => {
    const html = renderToStaticMarkup(<DraftOriginPanel origin={{ kind: "user" }} />);

    expect(html).toContain("You");
    expect(html).not.toContain("Provider / model");
    expect(html).not.toContain("Raw response hash");
  });

  it("keeps the full digest reachable when the shown one is truncated", () => {
    const html = renderToStaticMarkup(<DraftOriginPanel origin={CONNECTOR_ORIGIN} />);

    expect(html).toContain("b".repeat(64));
    expect(html).toContain(`title="${"b".repeat(64)}"`);
  });
});
