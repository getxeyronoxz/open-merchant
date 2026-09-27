import { describe, expect, it } from "vitest";

import { moneyLabel } from "../src/renderer/src/features/workspace/moneyLabel";

/**
 * Money fields name their currency, because a number without one is a number
 * the seller has to guess at. These tests are about the moment they cannot.
 */

describe("moneyLabel", () => {
  it("names the currency when there is one", () => {
    expect(moneyLabel("Product", "INR")).toBe("Product (INR)");
    expect(moneyLabel("Acquisition cost", "EUR")).toBe("Acquisition cost (EUR)");
  });

  it("drops the empty slot rather than showing empty brackets", () => {
    // "Product ()" reads as a bug in the app, not as a currency that has not
    // loaded yet — the first render of every money field hit this.
    expect(moneyLabel("Product", "")).toBe("Product");
    expect(moneyLabel("Product", "   ")).toBe("Product");
  });

  it("trims the code so a stray space does not print inside the brackets", () => {
    expect(moneyLabel("Product", " INR ")).toBe("Product (INR)");
  });

  it("leaves the label itself untouched", () => {
    expect(moneyLabel("Base price", "")).toBe("Base price");
  });
});
