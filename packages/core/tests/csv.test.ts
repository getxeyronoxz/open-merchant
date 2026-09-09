import { describe, expect, it } from "vitest";

import {
  detectCompetitorMapping,
  importCompetitorsFromCsv,
  parseCsv,
  serializeCompetitorsCsv,
  toCsv,
} from "../src/csv";
import type { Competitor } from "@open-merchant/shared";

describe("csv parse/serialize", () => {
  it("parses RFC 4180: quotes, escaped quotes, embedded newlines", () => {
    const text = [
      "name,notes",
      '"Board ""65%"", nice","line1',
      'line2"',
    ].join("\n");
    expect(parseCsv(text)).toEqual([
      ["name", "notes"],
      ['Board "65%", nice', "line1\nline2"],
    ]);
  });

  it("round-trips through toCsv with quoting", () => {
    const rows = [["a", 'b"c', "d,e\nf"]];
    const csv = toCsv(rows);
    expect(parseCsv(csv)).toEqual(rows);
  });

  it("serializes competitors with the documented header", () => {
    const competitor: Competitor = {
      id: "C-001",
      product: "Keyboard",
      brand: "Brand",
      price: "499.00",
      currency: "INR",
      marketplace: "Example",
      url: "https://example.com",
      sourceId: null,
      notes: "",
      observedAt: "2026-09-05T09:00:00.000Z",
    };
    const csv = serializeCompetitorsCsv([competitor]);
    expect(csv.startsWith("id,product,brand,price,currency,marketplace,url,notes\r\n")).toBe(true);
    expect(csv).toContain("C-001,Keyboard,Brand,499.00,INR,Example,https://example.com,");
  });
});

describe("competitor CSV import", () => {
  it("auto-detects columns and imports valid rows", () => {
    const result = importCompetitorsFromCsv(
      "Title,Brand,Amount,Store\nKeyboard A,BrandA,499.00,Example\nKeyboard B,BrandB,599.50,Example",
      {},
      "INR",
    );
    expect(result.competitors.length).toBe(2);
    expect(result.errors).toEqual([]);
    expect(result.competitors[0]?.product).toBe("Keyboard A");
    expect(result.competitors[0]?.price).toBe("499.00");
  });

  it("reports bad rows with reasons instead of silently fixing them", () => {
    const result = importCompetitorsFromCsv(
      "product,price\nKeyboard A,499.00\nKeyboard B,not-a-price\n,-50.00\nKeyboard C,abc",
      {},
      "INR",
    );
    expect(result.competitors.length).toBe(1);
    expect(result.skipped).toBe(3);
    expect(result.errors).toEqual([
      { row: 3, message: 'Price "not-a-price" is not a valid amount' },
      { row: 4, message: "Product name is required" },
      { row: 5, message: 'Price "abc" is not a valid amount' },
    ]);
  });

  it("detects the mapping and requires a product column", () => {
    expect(detectCompetitorMapping(["Item", "Cost"])).toEqual({ product: "Item", price: "Cost" });
    expect(() => importCompetitorsFromCsv("a,b\n1,2", {}, "INR")).toThrow(
      /Map the product column/u,
    );
  });
});