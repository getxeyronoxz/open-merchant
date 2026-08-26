import {
  competitorSchema,
  evidenceSourceSchema,
  reportSectionsSchema,
  type Competitor,
  type CostAssumptions,
  type EvidenceSource,
  type ReportSections,
} from "@open-merchant/shared";
import { z } from "zod";

import { WorkspaceStore, emptyAssumptions } from "./store";

/**
 * One-time migration from the legacy V0 Tauri-era folder format to V2.
 * The V0 project is opened read-only; a fresh V2 folder is created beside
 * it and populated field-by-field. Anything malformed in the source is
 * reported — never guessed at.
 */

const V0_MANIFEST_DIR = "merchant-project.json";

const v0ManifestSchema = z.object({
  name: z.string(),
  objective: z.string(),
  currency: z.string(),
});

// V0 stored JSON artifacts in camelCase (serde rename_all), with a
// redundant per-record schema_version. Only its CSV headers were snake_case.
const v0AssumptionsSchema = z.object({
  schemaVersion: z.number().optional(),
  currency: z.string(),
  acquisitionCost: z.string(),
  shippingCost: z.string(),
  marketplaceFeeRate: z.string(),
  paymentFeeRate: z.string(),
  otherCosts: z.string(),
  scenarioPrices: z.object({
    low: z.string().nullable(),
    base: z.string().nullable(),
    high: z.string().nullable(),
  }),
});

const v0SectionsSchema = z.object({
  schemaVersion: z.number().optional(),
  decisionSummary: z.string(),
  marketObservations: z.array(z.string()),
  risks: z.array(z.string()),
  opportunities: z.array(z.string()),
});

/** Minimal RFC4180 parser: handles quotes, escaped quotes, CRLF, embedded separators. */
export function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let index = 0;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    if (!(record.length === 1 && record[0] === "")) records.push(record);
    record = [];
  };

  while (index < text.length) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else if (char === "\r" && text[index + 1] === "\n") {
        // Normalize Windows newlines inside quoted fields to LF.
        field += "\n";
        index += 1;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushRecord();
    } else if (char !== "\r") {
      field += char;
    }
    index += 1;
  }
  if (field.length > 0 || record.length > 0) pushRecord();
  return records;
}

export class ImportV0Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportV0Error";
  }
}

export interface ImportV0Result {
  readonly newRoot: string;
  readonly importedEvidence: number;
  readonly importedCompetitors: number;
}

export async function importV0Project(
  v0Root: string,
  parentDirectoryForNewProject: string,
  readFileFn: (path: string) => Promise<string>,
): Promise<ImportV0Result> {
  // --- read all V0 inputs up front so failures happen before any writes ---
  let v0ManifestRaw: string;
  try {
    v0ManifestRaw = await readFileFn(`${v0Root}/${V0_MANIFEST_DIR}`);
  } catch {
    throw new ImportV0Error(`Not a V0 Open Merchant project (missing ${V0_MANIFEST_DIR}): ${v0Root}`);
  }

  const v0Manifest = v0ManifestSchema.parse(JSON.parse(v0ManifestRaw));

  const evidence: EvidenceSource[] = [];
  let sourcesRaw = "";
  try {
    sourcesRaw = await readFileFn(`${v0Root}/sources/sources.jsonl`);
  } catch {
    // V0 projects always have this file; treat absence as empty for robustness.
  }
  for (const line of sourcesRaw.split("\n")) {
    if (line.trim().length === 0) continue;
    const parsed = JSON.parse(line);
    delete parsed.schemaVersion;
    evidence.push(evidenceSourceSchema.parse(parsed));
  }

  const competitors: Competitor[] = [];
  let competitorsRaw = "";
  try {
    competitorsRaw = await readFileFn(`${v0Root}/market/competitors.csv`);
  } catch {
    // Absent market file imports as zero competitors.
  }
  const rows = parseCsvRecords(competitorsRaw);
  const header = rows[0] ?? [];
  for (const row of rows.slice(1)) {
    const record: Record<string, string> = {};
    header.forEach((key, columnIndex) => {
      record[key] = row[columnIndex] ?? "";
    });
    competitors.push(
      competitorSchema.parse({
        id: record.id,
        product: record.product,
        brand: record.brand,
        price: record.price && record.price.trim().length > 0 ? record.price : null,
        currency: record.currency,
        marketplace: record.marketplace,
        url: record.url,
        sourceId: record.source_id && record.source_id.length > 0 ? record.source_id : null,
        notes: record.notes,
        observedAt: record.observed_at,
      }),
    );
  }

  let assumptions: CostAssumptions = emptyAssumptions(v0Manifest.currency);
  try {
    const raw = v0AssumptionsSchema.parse(JSON.parse(await readFileFn(`${v0Root}/economics/assumptions.json`)));
    assumptions = {
      currency: raw.currency,
      acquisitionCost: raw.acquisitionCost,
      shippingCost: raw.shippingCost,
      marketplaceFeeRate: raw.marketplaceFeeRate,
      paymentFeeRate: raw.paymentFeeRate,
      otherCosts: raw.otherCosts,
      scenarioPrices: raw.scenarioPrices,
    };
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("ENOENT"))) throw error;
  }

  let sections: ReportSections | null = null;
  try {
    const raw = v0SectionsSchema.parse(JSON.parse(await readFileFn(`${v0Root}/reports/report-sections.json`)));
    sections = reportSectionsSchema.parse({
      decisionSummary: raw.decisionSummary,
      marketObservations: raw.marketObservations,
      risks: raw.risks,
      opportunities: raw.opportunities,
    });
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("ENOENT"))) throw error;
  }

  // --- build the V2 project ---
  const store = await WorkspaceStore.create({
    parentDirectory: parentDirectoryForNewProject,
    name: v0Manifest.name,
    objective: v0Manifest.objective,
    currency: v0Manifest.currency,
  });

  if (evidence.length > 0) await store.saveEvidence(evidence);
  await store.saveCompetitors(competitors);

  const finalAssumptions =
    assumptions.currency.toLowerCase() === store.manifest.currency.toLowerCase()
      ? assumptions
      : emptyAssumptions(store.manifest.currency);
  await store.saveAssumptions(finalAssumptions);
  if (sections) await store.saveReportSections(sections);

  return {
    newRoot: store.root,
    importedEvidence: evidence.length,
    importedCompetitors: competitors.length,
  };
}
