import type { Competitor, EvidenceSource } from "@open-merchant/shared";

import { ValidationError } from "./validation";
import { parseAmount } from "./money";

/**
 * File-first pillar (phase 2): dependency-free CSV in and out. The parser
 * follows RFC 4180 (quoted fields, escaped quotes, embedded newlines); the
 * importer validates every row and reports each rejected row with a reason —
 * dirty supplier data is never silently "fixed".
 */

/** Parses CSV text (RFC 4180) into a matrix. The first row is the header. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const character = text[i] as string;
    if (inQuotes) {
      if (character === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += character;
      i += 1;
      continue;
    }
    if (character === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (character === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (character === "\r") {
      if (text[i + 1] === "\n") i += 1;
      pushRow();
      i += 1;
      continue;
    }
    if (character === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += character;
    i += 1;
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

/** Serializes rows to CSV; fields containing separators, quotes, or newlines are quoted. */
export function toCsv(rows: readonly string[][]): string {
  return `${rows
    .map((row) =>
      row
        .map((field) =>
          /[",\r\n]/u.test(field) ? `"${field.replace(/"/gu, '""')}"` : field,
        )
        .join(","),
    )
    .join("\r\n")}\r\n`;
}

function csvCell(value: string | null): string {
  return value ?? "";
}

export function serializeCompetitorsCsv(competitors: Competitor[]): string {
  const rows: string[][] = [["id", "product", "brand", "price", "currency", "marketplace", "url", "notes"]];
  for (const competitor of competitors) {
    rows.push([
      competitor.id,
      competitor.product,
      competitor.brand,
      csvCell(competitor.price),
      competitor.currency,
      competitor.marketplace,
      competitor.url,
      competitor.notes,
    ]);
  }
  return toCsv(rows);
}

export function serializeEvidenceCsv(evidence: EvidenceSource[]): string {
  const rows: string[][] = [["id", "title", "url", "observedAt", "notes", "observations"]];
  for (const source of evidence) {
    rows.push([
      source.id,
      source.title,
      source.url,
      source.observedAt,
      source.notes,
      source.observations.map((o) => `${o.label}: ${o.value}${o.unit ?? ""}`).join("; "),
    ]);
  }
  return toCsv(rows);
}

export function serializeScenariosCsv(
  scenarios: { scenario: string; sellingPrice: string; totalCost: string; grossProfit: string; grossMarginPercent: string }[],
): string {
  const rows: string[][] = [["scenario", "sellingPrice", "totalCost", "grossProfit", "grossMarginPercent"]];
  for (const scenario of scenarios) {
    rows.push([
      scenario.scenario,
      scenario.sellingPrice,
      scenario.totalCost,
      scenario.grossProfit,
      scenario.grossMarginPercent,
    ]);
  }
  return toCsv(rows);
}

/** Column mapping: CSV header name → meaning. */
export interface CompetitorColumnMapping {
  product: string;
  brand: string;
  price: string;
  marketplace: string;
  url: string;
  notes: string;
}

export interface CompetitorImportRowError {
  readonly row: number;
  readonly message: string;
}

export interface CompetitorImportResult {
  readonly competitors: Omit<Competitor, "id">[];
  readonly errors: CompetitorImportRowError[];
  readonly skipped: number;
}

const HEADER_ALIASES: Record<keyof CompetitorColumnMapping, readonly string[]> = {
  product: ["product", "item", "title", "name"],
  brand: ["brand", "brand name", "manufacturer"],
  price: ["price", "cost", "amount", "selling price"],
  marketplace: ["marketplace", "market", "platform", "store"],
  url: ["url", "link", "listing url", "product url"],
  notes: ["notes", "note", "comments", "remarks"],
};

/** Auto-detects a column mapping from the CSV header (case-insensitive aliases). */
export function detectCompetitorMapping(header: readonly string[]): Partial<CompetitorColumnMapping> {
  const normalized = header.map((name) => name.trim().toLowerCase());
  const mapping: Partial<CompetitorColumnMapping> = {};
  for (const key of Object.keys(HEADER_ALIASES) as (keyof CompetitorColumnMapping)[]) {
    const index = normalized.findIndex((name) =>
      (HEADER_ALIASES[key] as readonly string[]).includes(name),
    );
    if (index >= 0) mapping[key] = header[index] as string;
  }
  return mapping;
}

function columnIndex(header: readonly string[], name: string | undefined): number {
  if (name === undefined) return -1;
  return header.findIndex((candidate) => candidate.trim().toLowerCase() === name.trim().toLowerCase());
}

/**
 * Imports competitor rows with per-row validation. Rows with hard errors
 * (missing product, malformed or negative price) are collected in `errors`
 * and excluded — never silently coerced. Columns not present in the mapping
 * are auto-detected from the header via known aliases.
 */
export function importCompetitorsFromCsv(
  csvText: string,
  mapping: Partial<CompetitorColumnMapping>,
  projectCurrency: string,
): CompetitorImportResult {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new ValidationError("The CSV file is empty");
  }
  const header = rows[0] as string[];
  const detected = detectCompetitorMapping(header);
  const effective: CompetitorColumnMapping = {
    product: mapping.product ?? detected.product ?? "",
    brand: mapping.brand ?? detected.brand ?? "",
    price: mapping.price ?? detected.price ?? "",
    marketplace: mapping.marketplace ?? detected.marketplace ?? "",
    url: mapping.url ?? detected.url ?? "",
    notes: mapping.notes ?? detected.notes ?? "",
  };
  if (effective.product === "" || columnIndex(header, effective.product) < 0) {
    throw new ValidationError("Map the product column to import competitors");
  }

  const indexes = {
    product: columnIndex(header, effective.product),
    brand: columnIndex(header, effective.brand),
    price: columnIndex(header, effective.price),
    marketplace: columnIndex(header, effective.marketplace),
    url: columnIndex(header, effective.url),
    notes: columnIndex(header, effective.notes),
  };

  const competitors: Omit<Competitor, "id">[] = [];
  const errors: CompetitorImportRowError[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] as string[];
    const rowNumber = index + 1; // 1-based; the header is row 1
    const cell = (position: number): string =>
      position < 0 || position >= row.length ? "" : (row[position] as string).trim();
    const product = cell(indexes.product);
    const priceRaw = cell(indexes.price);

    if (product.length === 0) {
      if (row.every((field) => field.trim() === "")) continue; // blank line, not an error
      errors.push({ row: rowNumber, message: "Product name is required" });
      continue;
    }
    let price: string | null = null;
    if (priceRaw.length > 0) {
      const candidate = priceRaw.replace(/^\+/, "").replace(/^[^\d-]+/u, "").trim();
      try {
        const parsed = parseAmount(candidate);
        if (parsed.isNegative()) {
          errors.push({ row: rowNumber, message: `Price "${priceRaw}" is negative` });
          continue;
        }
        price = candidate;
      } catch {
        errors.push({ row: rowNumber, message: `Price "${priceRaw}" is not a valid amount` });
        continue;
      }
    }

    competitors.push({
      product,
      brand: cell(indexes.brand),
      price,
      currency: projectCurrency,
      marketplace: cell(indexes.marketplace),
      url: cell(indexes.url),
      sourceId: null,
      notes: cell(indexes.notes),
      observedAt: new Date().toISOString(),
    });
  }

  return { competitors, errors, skipped: errors.length };
}