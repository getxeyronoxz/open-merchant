import { readFile, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as Core from "@open-merchant/core";
import { AppError, type CostAssumptions, type RunRecord } from "@open-merchant/shared";

import { MerchantService } from "../src/main/service";

/**
 * The real `writeCurrencyPlan` runs, and rolls back for real, in the core
 * suite. Here only its failure is simulated, because the service's own
 * responsibility — what it journals when a change cannot land — cannot be
 * provoked from outside a process that has already read every artifact.
 */
let nextWriteFailure: Error | null = null;

vi.mock("@open-merchant/core", async (importOriginal) => {
  const actual = await importOriginal<typeof Core>();
  return {
    ...actual,
    writeCurrencyPlan: (root: string, plan: Parameters<typeof actual.writeCurrencyPlan>[1]) => {
      if (nextWriteFailure !== null) {
        const failure = nextWriteFailure;
        nextWriteFailure = null;
        return Promise.reject(failure);
      }
      return actual.writeCurrencyPlan(root, plan);
    },
  };
});

/**
 * The currency change, end to end through the real service.
 *
 * The two properties worth defending are that a preview touches nothing at all,
 * and that what the journal says about the change is what the folder actually
 * holds. A record that disagreed with the bytes would be worse than no record:
 * it would be the only account of a rewrite nobody could check.
 */

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "om-currency-app-"));
  tempDirs.push(dir);
  return dir;
}

function service(): MerchantService {
  return new MerchantService("9.9.9-test");
}

async function makeProject(name: string, currency = "INR"): Promise<string> {
  const parent = await tempDir();
  const created = await service().createProject({
    parentDirectory: parent,
    name,
    objective: "Decide whether this opportunity is worth pursuing.",
    currency,
  });
  const root = created.root;
  const { WorkspaceStore } = await import("@open-merchant/core");
  const store = await WorkspaceStore.open(root);
  await store.saveAssumptions({
    currency,
    acquisitionCost: "500.00",
    shippingCost: "75.50",
    marketplaceFeeRate: "12.00",
    paymentFeeRate: "2.50",
    otherCosts: "20.00",
    scenarioPrices: { low: "899.99", base: "1099.99", high: "1499.99" },
    marginThresholdPercent: "20.00",
  } satisfies CostAssumptions);
  const observedAt = new Date().toISOString();
  await store.saveCompetitors([
    {
      id: "C-001",
      product: "Kailh Box Jade",
      brand: "Kailh",
      price: "1099.00",
      currency,
      marketplace: "Amazon.in",
      url: "https://example.com/listing",
      sourceId: null,
      notes: "",
      observedAt,
    },
  ]);
  return root;
}

async function readRuns(root: string): Promise<RunRecord[]> {
  const raw = await readFile(join(root, ".openmerchant", "runs.jsonl"), "utf8");
  return raw
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as RunRecord);
}

function only<T>(items: T[]): T {
  expect(items).toHaveLength(1);
  return items[0] as T;
}

async function readJson<T>(root: string, relativePath: string): Promise<T> {
  return JSON.parse(await readFile(join(root, ...relativePath.split("/")), "utf8")) as T;
}

describe("currencyPreview", () => {
  it("reports the change without writing a single byte", async () => {
    const root = await makeProject("Keyboards");
    const before = await readFile(join(root, "economics", "assumptions.json"), "utf8");
    const runs = await readRuns(root);

    const preview = await service().currencyPreview(root, "EUR", "0.011");

    expect(preview.fromCurrency).toBe("INR");
    expect(preview.toCurrency).toBe("EUR");
    expect(preview.changedCount).toBeGreaterThan(0);
    expect(Object.keys(preview.newValues)).toEqual(Object.keys(preview.oldValues));
    expect(await readFile(join(root, "economics", "assumptions.json"), "utf8")).toBe(before);
    expect(await readRuns(root)).toHaveLength(runs.length);
  });

  it("says which values move, by artifact and field", async () => {
    const root = await makeProject("Keyboards");

    const preview = await service().currencyPreview(root, "EUR", "0.011");

    expect(preview.newValues).toMatchObject({
      "economics/assumptions.json#acquisitionCost": "5.50",
      "market/competitors.json#C-001.price": "12.09",
    });
    // The percentage did not move, so it is in neither map.
    expect(preview.oldValues["economics/assumptions.json#marketplaceFeeRate"]).toBeUndefined();
  });

  it("refuses a change into the currency the project is already in", async () => {
    const root = await makeProject("Keyboards");

    await expect(service().currencyPreview(root, "INR", "1")).rejects.toBeInstanceOf(AppError);
  });
});

describe("applyCurrencyChange", () => {
  it("converts every artifact on disk and journals the result", async () => {
    const root = await makeProject("Keyboards");
    const { WorkspaceStore, calculateScenarios } = await import("@open-merchant/core");
    const store = await WorkspaceStore.open(root);
    await store.saveScenarios(calculateScenarios(await store.loadAssumptions()));
    await store.captureMarketSnapshot("before the change");
    const runsBefore = await readRuns(root);

    const result = await service().applyCurrencyChange(root, "EUR", "0.011");

    const manifest = await readJson<{ currency: string }>(root, ".openmerchant/manifest.json");
    const assumptions = await readJson<CostAssumptions>(root, "economics/assumptions.json");
    const competitors = await readJson<{ currency: string; price: string }[]>(
      root,
      "market/competitors.json",
    );
    expect(manifest.currency).toBe("EUR");
    expect(assumptions.currency).toBe("EUR");    expect(assumptions.acquisitionCost).toBe("5.50");
    expect(assumptions.marketplaceFeeRate).toBe("12.00");
    expect(competitors[0]?.currency).toBe("EUR");
    expect(competitors[0]?.price).toBe("12.09");

    const snapshots = await store.listMarketSnapshots();
    expect(snapshots[0]?.listings[0]?.currency).toBe("EUR");
    expect(snapshots[0]?.listings[0]?.price).toBe("12.09");

    // Exactly one run, and it carries the change it made.
    const runs = await readRuns(root);
    const appended = only(runs.filter((run) => run.operation === "currencyChanged"));
    expect(runs).toHaveLength(runsBefore.length + 1);
    expect(appended.status).toBe("succeeded");
    expect(appended.currencyChange?.runId).toBe(appended.runId);
    expect(appended.currencyChange?.toCurrency).toBe("EUR");
    expect(appended.currencyChange?.rate).toBe("0.011");
    expect(appended.currencyChange?.beforeHash).toBe(result.change.beforeHash);
    expect(appended.currencyChange?.afterHash).toBe(result.change.afterHash);
    expect(appended.inputArtifacts).toEqual([]);
    expect(appended.outputArtifacts.length).toBeGreaterThan(0);
  });

  it("returns the manifest the change left behind", async () => {
    // Every screen reads the currency from the manifest. If the response did
    // not carry the new one, the app would go on pricing in the old currency
    // until the window was reopened.
    const root = await makeProject("Keyboards");

    const result = await service().applyCurrencyChange(root, "EUR", "0.011");

    expect(result.snapshot.root).toBe(root);
    expect(result.snapshot.manifest.currency).toBe("EUR");
    expect(result.snapshot.manifest).toEqual(
      await readJson(root, ".openmerchant/manifest.json"),
    );
  });

  it("journals the old and new values that are actually on disk", async () => {
    const root = await makeProject("Keyboards");

    const result = await service().applyCurrencyChange(root, "EUR", "0.011");

    const runs = await readRuns(root);
    const change = only(runs.filter((run) => run.operation === "currencyChanged")).currencyChange;
    expect(change).toEqual(result.change);
    // The "old" side is what the folder held a moment ago, not a copy the
    // service kept: it is the value the manifest's own currency came from.
    expect(change?.oldValues["market/competitors.json#C-001.price"]).toBe("1099.00");
    const competitors = await readJson<{ price: string }[]>(root, "market/competitors.json");
    expect(competitors[0]?.price).toBe(change?.newValues["market/competitors.json#C-001.price"]);
  });

  it("writes the run's fingerprints of what it changed", async () => {
    const root = await makeProject("Keyboards");

    await service().applyCurrencyChange(root, "EUR", "0.011");

    const appended = only(
      (await readRuns(root)).filter((run) => run.operation === "currencyChanged"),
    );
    const changed = await readFile(join(root, "market", "competitors.json"), "utf8");
    const { createHash } = await import("node:crypto");
    const fingerprint = appended.outputArtifacts.find(
      (entry) => entry.path === "market/competitors.json",
    );
    expect(fingerprint?.sha256).toBe(createHash("sha256").update(changed).digest("hex"));
  });

  it("leaves a readable project behind", async () => {
    const root = await makeProject("Keyboards");

    await service().applyCurrencyChange(root, "EUR", "0.011");

    // Every store read validates against the manifest's currency, so a mixed
    // project would fail here rather than quietly showing wrong numbers.
    const { WorkspaceStore } = await import("@open-merchant/core");
    const store = await WorkspaceStore.open(root);
    expect(store.manifest.currency).toBe("EUR");
    expect((await store.loadCompetitors())[0]?.currency).toBe("EUR");
    expect((await store.loadAssumptions()).currency).toBe("EUR");
  });

  it("refuses a bad rate before it starts, changing no bytes and writing no run", async () => {
    // A rate of zero is a typo, not an attempt. The project was never touched,
    // so the journal has nothing to record.
    const root = await makeProject("Keyboards");
    const before = await readFile(join(root, "market", "competitors.json"), "utf8");
    const runsBefore = await readRuns(root);

    await expect(service().applyCurrencyChange(root, "EUR", "0")).rejects.toBeInstanceOf(AppError);

    expect(await readFile(join(root, "market", "competitors.json"), "utf8")).toBe(before);
    expect(await readRuns(root)).toHaveLength(runsBefore.length);
  });

  it("refuses a same-currency change", async () => {
    const root = await makeProject("Keyboards");

    await expect(service().applyCurrencyChange(root, "INR", "1")).rejects.toBeInstanceOf(AppError);
    expect((await readJson<{ currency: string }>(root, ".openmerchant/manifest.json")).currency).toBe(
      "INR",
    );
  });

  it("journals a change that could not land as a failure with no payload", async () => {
    const root = await makeProject("Keyboards");
    nextWriteFailure = new Error("disk went away mid-change");

    await expect(service().applyCurrencyChange(root, "EUR", "0.011")).rejects.toBeInstanceOf(
      AppError,
    );

    const failed = only(
      (await readRuns(root)).filter((run) => run.operation === "currencyChanged"),
    );
    expect(failed.status).toBe("failed");
    expect(failed.errorSummary).toContain("disk went away");
    // The run record cannot carry a description of a conversion that did not
    // happen, and the schema refuses one.
    expect(failed.currencyChange).toBeUndefined();
    expect(failed.outputArtifacts).toEqual([]);
  });

  it("refuses to convert a project it cannot fully read", async () => {
    // A snapshot that cannot be parsed is a project whose history would be left
    // in the old currency while everything else moved. Refusing is the only
    // honest answer.
    const root = await makeProject("Keyboards");
    const { WorkspaceStore } = await import("@open-merchant/core");
    const store = await WorkspaceStore.open(root);
    const captured = await store.captureMarketSnapshot("before the change");
    const snapshotPath = join(root, "market", "snapshots", `${captured.snapshot.id}.json`);
    await rm(snapshotPath);
    const { mkdir } = await import("node:fs/promises");
    await mkdir(snapshotPath);
    const assumptionsBefore = await readFile(
      join(root, "economics", "assumptions.json"),
      "utf8",
    );
    const runsBefore = await readRuns(root);

    await expect(service().applyCurrencyChange(root, "EUR", "0.011")).rejects.toBeInstanceOf(
      AppError,
    );

    expect(await readFile(join(root, "economics", "assumptions.json"), "utf8")).toBe(
      assumptionsBefore,
    );
    expect(await readRuns(root)).toHaveLength(runsBefore.length);
  });
});
