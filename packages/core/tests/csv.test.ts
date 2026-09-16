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

  it("rejects an empty file instead of importing nothing silently", () => {
    expect(() => importCompetitorsFromCsv("", {}, "INR")).toThrow(/empty/iu);
    // A whitespace-only file has no header row to map, so the importer must
    // still refuse loudly rather than import zero rows as success.
    expect(() => importCompetitorsFromCsv("   \n  ", {}, "INR")).toThrow(
      /Map the product column|empty/iu,
    );
  });

  it("rejects negative prices and strips currency symbols deterministically", () => {
    const result = importCompetitorsFromCsv(
      "product,price\nKeyboard A,-50.00\nKeyboard B,₹ 599.50\nKeyboard C,+749",
      {},
      "INR",
    );
    expect(result.competitors.map((entry) => entry.product)).toEqual(["Keyboard B", "Keyboard C"]);
    expect(result.errors).toEqual([{ row: 2, message: 'Price "-50.00" is negative' }]);
    expect(result.competitors[0]?.price).toBe("599.50");
    expect(result.competitors[1]?.price).toBe("749");
  });

  it("skips blank lines without counting them as errors", () => {
    const result = importCompetitorsFromCsv(
      "product,price\nKeyboard A,499.00\n\n   \nKeyboard B,599.50\n",
      {},
      "INR",
    );
    expect(result.competitors).toHaveLength(2);
    expect(result.errors).toEqual([]);
    expect(result.skipped).toBe(0);
  });

  it("respects an explicit column mapping over auto-detection", () => {
    const result = importCompetitorsFromCsv(
      "Item,Store,Notes\nKeyboard A,Example,ships fast",
      { product: "Item", marketplace: "Store", notes: "Notes" },
      "INR",
    );
    expect(result.errors).toEqual([]);
    expect(result.competitors[0]?.product).toBe("Keyboard A");
    expect(result.competitors[0]?.marketplace).toBe("Example");
    expect(result.competitors[0]?.notes).toBe("ships fast");
  });
});