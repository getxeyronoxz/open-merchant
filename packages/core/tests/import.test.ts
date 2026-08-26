import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { parseCsvRecords } from "../src/importV0";
import { WorkspaceStore } from "../src/store";

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "open-merchant-import-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("parseCsvRecords (RFC4180)", () => {
  it("handles quoted fields, escaped quotes, CRLF, and embedded separators", () => {
    const csv = [
      'id,notes,"desc"',
      'C-001,"has, comma","say ""hi"""',
      'C-002,"multi\r\nline",plain',
    ].join("\r\n");
    expect(parseCsvRecords(csv)).toEqual([
      ["id", "notes", "desc"],
      ["C-001", "has, comma", 'say "hi"'],
      ["C-002", "multi\nline", "plain"],
    ]);
  });

  it("treats a blank trailing line as no record", () => {
    expect(parseCsvRecords("a,b\n")).toEqual([["a", "b"]]);
  });
});

describe("importV0Project", () => {
  it("migrates a V0 folder into a valid V2 project", async () => {
    const v0Root = await tempDir();
    const newParent = await tempDir();

    // Lay down a minimal V0 project in the legacy snake_case format.
    await mkdir(join(v0Root, "sources"), { recursive: true });
    await mkdir(join(v0Root, "market"), { recursive: true });
    await mkdir(join(v0Root, "economics"), { recursive: true });
    await mkdir(join(v0Root, "reports"), { recursive: true });

    await writeFile(
      join(v0Root, "merchant-project.json"),
      JSON.stringify({
        schema_version: 1,
        project_id: "9f6a4ab2-1b3d-4c5e-8f70-a2b3c4d5e6f7",
        name: "Mechanical Keyboards India",
        objective: "Decide whether to enter the market",
        currency: "INR",
      }),
      "utf8",
    );
    await writeFile(
      join(v0Root, "sources/sources.jsonl"),
      `${JSON.stringify({
        schemaVersion: 1,
        id: "S-001",
        url: "https://example.com/kb",
        title: "Category page",
        notes: "",
        observations: [],
        observedAt: "2026-08-01T10:00:00+00:00",
        createdAt: "2026-08-01T10:00:00+00:00",
        updatedAt: "2026-08-01T10:00:00+00:00",
      })}\n`,
      "utf8",
    );
    await writeFile(
      join(v0Root, "market/competitors.csv"),
      [
        "schema_version,id,product,brand,price,currency,marketplace,url,source_id,notes,observed_at",
        '1,C-001,"Keyboard, 65%",KeyBrand,499.00,INR,Example Bazaar,https://example.com,S-001,,"2026-08-01T10:00:00+00:00"',
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(v0Root, "economics/assumptions.json"),
      JSON.stringify({
        schemaVersion: 1,
        currency: "INR",
        acquisitionCost: "500.00",
        shippingCost: "75.50",
        marketplaceFeeRate: "12.50",
        paymentFeeRate: "2.35",
        otherCosts: "20.00",
        scenarioPrices: { low: "899.99", base: "1099.99", high: "1499.99" },
      }),
      "utf8",
    );
    await writeFile(
      join(v0Root, "reports/report-sections.json"),
      JSON.stringify({
        schemaVersion: 1,
        decisionSummary: "Enter with care.",
        marketObservations: ["Strong demand."],
        risks: ["Duties."],
        opportunities: ["Bundles."],
      }),
      "utf8",
    );

    const { importV0Project } = await import("../src/importV0");
    const result = await importV0Project(v0Root, newParent, (path) => readFile(path, "utf8"));

    expect(result.importedEvidence).toBe(1);
    expect(result.importedCompetitors).toBe(1);

    const store = await WorkspaceStore.open(result.newRoot);
    expect(store.manifest.currency).toBe("INR");
    expect((await store.loadEvidence())[0]?.id).toBe("S-001");

    const competitor = (await store.loadCompetitors())[0];
    expect(competitor?.product).toBe("Keyboard, 65%");
    expect(competitor?.price).toBe("499.00");
    expect(competitor?.sourceId).toBe("S-001");

    const assumptions = await store.loadAssumptions();
    expect(assumptions.acquisitionCost).toBe("500.00");
    expect(assumptions.scenarioPrices.base).toBe("1099.99");

    expect((await store.loadReportSections()).decisionSummary).toBe("Enter with care.");
  });

  it("rejects folders that are not V0 projects", async () => {
    const empty = await tempDir();
    const parent = await tempDir();
    const { importV0Project } = await import("../src/importV0");
    await expect(importV0Project(empty, parent, (path) => readFile(path, "utf8"))).rejects.toThrow(/not a V0/iu);
  });
});
