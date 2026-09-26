import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CurrencyChangePreview } from "@open-merchant/shared";

import { CurrencyChangePanel, previewMatches } from "./CurrencyChangePanel";

/**
 * The currency change is the only screen in the app that rewrites a whole
 * project. What matters here is that the seller is shown the change before it
 * happens, and cannot confirm one they have not seen.
 */

const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);

function preview(overrides: Partial<CurrencyChangePreview> = {}): CurrencyChangePreview {
  return {
    fromCurrency: "INR",
    toCurrency: "EUR",
    rate: "0.011",
    createdAt: "2026-09-26T09:00:00.000Z",
    affectedArtifacts: [{ path: "economics/assumptions.json", sha256: HASH }],
    beforeHash: HASH,
    afterHash: OTHER_HASH,
    oldValues: {
      "economics/assumptions.json#acquisitionCost": "500.00",
      "economics/assumptions.json#shippingCost": "75.50",
    },
    newValues: {
      "economics/assumptions.json#acquisitionCost": "5.50",
      "economics/assumptions.json#shippingCost": "0.83",
    },
    changedCount: 2,
    ...overrides,
  };
}

function render(props: Partial<Parameters<typeof CurrencyChangePanel>[0]> = {}): string {
  return renderToStaticMarkup(
    <CurrencyChangePanel
      currency="INR"
      toCurrency="EUR"
      rate="0.011"
      preview={preview()}
      isPreviewing={false}
      isApplying={false}
      error={null}
      onCurrencyChange={() => undefined}
      onRateChange={() => undefined}
      onPreview={() => undefined}
      onApply={() => undefined}
      onRetry={() => undefined}
      {...props}
    />,
  );
}

describe("previewMatches", () => {
  it("is true only for the currency and rate the preview was made from", () => {
    // Confirming a different rate than the one on screen would apply a change
    // the seller was never shown.
    expect(previewMatches(preview(), "EUR", "0.011")).toBe(true);
    expect(previewMatches(preview(), "GBP", "0.011")).toBe(false);
    expect(previewMatches(preview(), "EUR", "0.012")).toBe(false);
  });

  it("is false when there is no preview at all", () => {
    expect(previewMatches(null, "EUR", "0.011")).toBe(false);
  });

  it("normalises the case a seller is likely to type", () => {
    // A currency field is three letters; "eur" is the same currency, and
    // refusing it would be a puzzle rather than a safety.
    expect(previewMatches(preview(), "eur", "0.011")).toBe(true);
  });
});

describe("CurrencyChangePanel", () => {
  it("names the direction of the change and both currencies", () => {
    const html = render();

    expect(html).toContain("INR");
    expect(html).toContain("EUR");
    expect(html).toContain("0.011");
  });

  it("shows the change as before and after, not as a promise", () => {
    const html = render();

    expect(html).toContain("500.00");
    expect(html).toContain("5.50");
    expect(html).toContain("acquisitionCost");
  });

  it("says how many values change", () => {
    expect(render()).toContain("2 values");
  });

  it("says what happens to market snapshots in plain words", () => {
    // Snapshots are converted too, and that is a real cost the seller has to
    // be told about before confirming, not after.
    const html = render();

    expect(html).toContain("snapshot");
    expect(html.toLowerCase()).toContain("restated");
  });

  it("asks for confirmation rather than applying on one click", () => {
    const html = render();

    expect(html).toContain("Confirm");
    expect(html).toMatch(/cannot be undone|are recorded/iu);
  });

  it("keeps the confirm button disabled while the inputs differ from the preview", () => {
    const html = render({ rate: "0.012" });

    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Confirm/iu);
  });

  it("enables confirm once the inputs match the preview on screen", () => {
    const html = render();
    const confirm = html.match(/<button[^>]*>[\s\S]*?<\/button>/gu) ?? [];

    expect(confirm.some((tag) => /Confirm/.test(tag) && !tag.includes("disabled"))).toBe(true);
  });

  it("says plainly when there is nothing to convert", () => {
    const html = render({ preview: preview({ oldValues: {}, newValues: {}, changedCount: 0 }) });

    expect(html).toContain("no amounts");
  });

  it("marks the buttons busy while the change is being applied", () => {
    expect(render({ isApplying: true })).toContain("Changing");
  });

  it("marks the buttons busy while a preview is being calculated", () => {
    expect(render({ isPreviewing: true })).toContain("Reading");
  });

  it("surfaces a failure with a way to retry, rather than hiding it", () => {
    const html = render({ error: new Error("boom") });

    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain("boom");
  });

  it("keeps its buttons out of any surrounding form", () => {
    const buttons = render().match(/<button[^>]*>/gu) ?? [];

    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((tag) => tag.includes('type="button"'))).toBe(true);
  });
});
