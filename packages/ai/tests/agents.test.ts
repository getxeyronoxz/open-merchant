import { describe, expect, it } from "vitest";

import { AiParseError, draftEvidenceSource, draftReportSections } from "../src/agents";
import { createMockProvider } from "../src/providers";

describe("draftEvidenceSource", () => {
  const material = [
    "Title: Nova65 Hot-swap Keyboard",
    "Price: ₹4,499",
    "Marketplace: Example Bazaar",
    "Ships in 2-3 weeks from Mumbai warehouse.",
  ].join("\n");

  it("produces a valid evidence draft from scripted JSON output", async () => {
    const json = JSON.stringify({
      id: "S-009",
      url: "https://example.com/nova65",
      title: "Nova65 listing on Example Bazaar",
      notes: "Entry-level hot-swap board.",
      observations: [
        { id: "O-1", label: "Asking price", value: "4499.00", unit: "INR" },
        { id: "O-2", label: "Lead time", value: "2-3 weeks", unit: null },
      ],
    });
    const result = await draftEvidenceSource(createMockProvider({ reply: json }), {
      nextId: "S-009",
      url: "https://example.com/nova65",
      pageText: material,
    });

    expect(result.value.id).toBe("S-009");
    expect(result.value.title).toBe("Nova65 listing on Example Bazaar");
    expect(result.value.observations).toHaveLength(2);
    expect(result.value.createdAt).toBeTruthy();
  });

  it("tolerates fenced code blocks around the JSON", async () => {
    const json = `\`\`\`json\n${JSON.stringify({
      id: "S-010",
      url: "https://example.com/x",
      title: "Titled",
      notes: "",
      observations: [],
    })}\n\`\`\``;
    const result = await draftEvidenceSource(createMockProvider({ reply: json }), {
      nextId: "S-010",
      url: "https://example.com/x",
      pageText: material,
    });
    expect(result.value.title).toBe("Titled");
  });

  it("rejects malformed model output instead of guessing", async () => {
    await expect(
      draftEvidenceSource(createMockProvider({ reply: "I could not find any details." }), {
        nextId: "S-011",
        url: "https://example.com/empty",
        pageText: material,
      }),
    ).rejects.toBeInstanceOf(AiParseError);
  });
});

describe("draftReportSections", () => {
  const input = {
    objective: "Decide whether to enter the Indian enthusiast keyboard market.",
    currency: "INR",
    evidence: [{ id: "S-001", title: "Category page", notes: "Entry boards cluster near 4500." }],
    competitors: [{ id: "C-001", product: "Nova65", price: "4499.00", marketplace: "Example Bazaar" }],
    statistics: { validPriceCount: 1, minimum: "4499.00", maximum: "4499.00", average: "4499.00", median: "4499.00" },
    assumptions: {
      currency: "INR",
      acquisitionCost: "1800.00",
      shippingCost: "180.00",
      marketplaceFeeRate: "12.00",
      paymentFeeRate: "2.00",
      otherCosts: "120.00",
      scenarioPrices: { low: "3499.00", base: "4499.00", high: "5499.00" },
    },
    scenarios: [],
  };

  it("returns validated sections from structured output", async () => {
    const json = JSON.stringify({
      decisionSummary: "Margins hold at the base case; validate supplier quotes first.",
      marketObservations: ["Entry boards cluster near INR 4,500."],
      risks: ["Import duties may erode the base-case margin."],
      opportunities: ["Bundle keycaps to lift average order value."],
    });
    const result = await draftReportSections(createMockProvider({ reply: json }), input);
    expect(result.value.marketObservations).toHaveLength(1);
    expect(result.value.risks[0]).toContain("duties");
  });

  it("fills defaults when the model omits lists", async () => {
    const result = await draftReportSections(
      createMockProvider({ reply: JSON.stringify({ decisionSummary: "Proceed carefully." }) }),
      input,
    );
    expect(result.value.decisionSummary).toBe("Proceed carefully.");
    expect(result.value.marketObservations).toEqual([]);
  });
});
