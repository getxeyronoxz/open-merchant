import { describe, expect, it } from "vitest";

import {
  AiParseError,
  auditReport,
  draftCompetitorEntries,
  draftEvidenceSource,
  draftReportSections,
  draftResearchPlan,
  reviewEconomics,
} from "../src/agents";
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

  it("rejects schema-violating sections instead of saving them", async () => {
    await expect(
      draftReportSections(
        createMockProvider({ reply: JSON.stringify({ decisionSummary: 42 }) }),
        input,
      ),
    ).rejects.toThrow();
  });

  it("ignores prose around the JSON payload", async () => {
    const json = JSON.stringify({
      decisionSummary: "Proceed carefully.",
      marketObservations: [],
      risks: [],
      opportunities: [],
    });
    const result = await draftReportSections(
      createMockProvider({ reply: `Here is the draft:\n${json}\nHope this helps.` }),
      input,
    );
    expect(result.value.decisionSummary).toBe("Proceed carefully.");
  });
});

describe("draftResearchPlan", () => {
  it("returns an ordered checklist from structured output", async () => {
    const json = JSON.stringify({
      steps: [
        { title: "Collect five comparable listings", why: "Ground the price statistics." },
        { title: "Record supplier quotes", why: "Fix acquisition cost." },
      ],
    });
    const result = await draftResearchPlan(
      createMockProvider({ reply: json }),
      "Decide market entry",
      "INR",
    );
    expect(result.value.steps).toHaveLength(2);
    expect(result.value.steps[0]?.title).toContain("listings");
  });

  it("rejects malformed JSON while accepting a well-formed empty plan", async () => {
    // The schema permits an empty checklist; the planner prompt asks for 3-6
    // steps, but an honest empty plan must not become a validation error.
    const empty = await draftResearchPlan(
      createMockProvider({ reply: JSON.stringify({ steps: [] }) }),
      "x",
      "INR",
    );
    expect(empty.value.steps).toEqual([]);
    await expect(
      draftResearchPlan(createMockProvider({ reply: "no json here" }), "x", "INR"),
    ).rejects.toBeInstanceOf(AiParseError);
  });
});

describe("draftCompetitorEntries", () => {
  const listings = "Nova65 hot-swap keyboard — ₹4,499 on Example Bazaar";

  it("extracts competitor drafts with defaults for missing fields", async () => {
    const json = JSON.stringify({
      competitors: [{ product: "Nova65", brand: "", price: "4499.00", marketplace: "", url: "" }],
    });
    const result = await draftCompetitorEntries(createMockProvider({ reply: json }), {
      currency: "INR",
      pastedListings: listings,
    });
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.product).toBe("Nova65");
    expect(result.value[0]?.price).toBe("4499.00");
  });

  it("keeps unpriced listings as null instead of inventing a price", async () => {
    const json = JSON.stringify({
      competitors: [{ product: "Nova65", brand: "", price: null, marketplace: "", url: "" }],
    });
    const result = await draftCompetitorEntries(createMockProvider({ reply: json }), {
      currency: "INR",
      pastedListings: listings,
    });
    expect(result.value[0]?.price).toBeNull();
  });

  it("rejects invented price shapes", async () => {
    const json = JSON.stringify({
      competitors: [{ product: "Nova65", brand: "", price: "44.999", marketplace: "", url: "" }],
    });
    await expect(
      draftCompetitorEntries(createMockProvider({ reply: json }), {
        currency: "INR",
        pastedListings: listings,
      }),
    ).rejects.toThrow();
  });
});

describe("reviewEconomics", () => {
  const input = {
    assumptions: {
      currency: "INR",
      acquisitionCost: "500.00",
      shippingCost: "75.50",
      marketplaceFeeRate: "12.50",
      paymentFeeRate: "2.35",
      otherCosts: "20.00",
      scenarioPrices: { low: "899.99", base: "1099.99", high: "1499.99" },
    },
    scenarios: [],
    statistics: {
      validPriceCount: 1,
      minimum: "749.00",
      maximum: "749.00",
      average: "749.00",
      median: "749.00",
    },
  };

  it("returns a verdict with findings from structured output", async () => {
    const json = JSON.stringify({
      verdict: "caution",
      summary: "Base margin is thin against the market median.",
      findings: [{ severity: "warning", message: "Re-check supplier quotes." }],
    });
    const result = await reviewEconomics(createMockProvider({ reply: json }), input);
    expect(result.value.verdict).toBe("caution");
    expect(result.value.findings).toHaveLength(1);
  });

  it("rejects unknown verdicts instead of softening them", async () => {
    const json = JSON.stringify({ verdict: "fine", summary: "x", findings: [] });
    await expect(reviewEconomics(createMockProvider({ reply: json }), input)).rejects.toThrow();
  });
});

describe("auditReport", () => {
  const input = {
    reportMarkdown: "# Keyboards\n\nEnter with a limited batch.",
    evidenceSummaries: [{ id: "S-001", title: "Category page", notes: "Boards cluster near 4500." }],
  };

  it("assesses claims against the recorded evidence", async () => {
    const json = JSON.stringify({
      verdict: "gaps-found",
      summary: "One claim lacks a source.",
      findings: [{ status: "unverified", claim: "Demand is rising.", note: "No source on record." }],
    });
    const result = await auditReport(createMockProvider({ reply: json }), input);
    expect(result.value.verdict).toBe("gaps-found");
    expect(result.value.findings[0]?.status).toBe("unverified");
  });

  it("rejects unknown claim statuses", async () => {
    const json = JSON.stringify({
      verdict: "sound",
      summary: "x",
      findings: [{ status: "maybe", claim: "x", note: "y" }],
    });
    await expect(auditReport(createMockProvider({ reply: json }), input)).rejects.toThrow();
  });
});
