import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type {
  Competitor,
  CostAssumptions,
  EconomicsScenario,
  Manifest,
} from "@open-merchant/shared";
import { afterEach, describe, expect, it } from "vitest";

import {
  hashArtifactSet,
  planCurrencyChange,
  writeCurrencyPlan,
  type CurrencyChangeInput,
  type CurrencyChangePlan,
} from "../src/currency-change";
import { DomainError } from "../src/economics";
import { buildMarketSnapshot } from "../src/snapshots";
import { competitorStatistics } from "../src/statistics";

/**
 * The currency change is the one operation that rewrites every artifact a
 * project owns. Two things must hold without exception: no dimensionless
 * number is ever multiplied by an exchange rate, and a change either lands
 * completely or not at all.
 */

const CHANGED_AT = "2026-09-26T09:00:00.000Z";
const RATE = "0.011";
const MANIFEST_PATH = ".openmerchant/manifest.json";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "om-currency-"));
  tempDirs.push(dir);
  return dir;
}

function manifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    schemaVersion: 2,
    projectId: "6f1a0e4c-1f2b-4a3d-9c8e-0b1a2c3d4e5f",
    name: "Keyboards",
    objective: "Decide whether this is worth pursuing.",
    currency: "INR",
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
    ...overrides,
  };
}

function assumptions(overrides: Partial<CostAssumptions> = {}): CostAssumptions {
  return {
    currency: "INR",
    acquisitionCost: "500.00",
    shippingCost: "75.50",
    marketplaceFeeRate: "12.00",
    paymentFeeRate: "2.50",
    otherCosts: "20.00",
    scenarioPrices: { low: "899.99", base: "1099.99", high: "1499.99" },
    marginThresholdPercent: "20.00",
    ...overrides,
  };
}

function scenario(overrides: Partial<EconomicsScenario> = {}): EconomicsScenario {
  return {
    scenario: "base",
    sellingPrice: "1099.99",
    acquisitionCost: "500.00",
    shippingCost: "75.50",
    marketplaceFeeRate: "12.00",
    marketplaceFee: "132.00",
    paymentFeeRate: "2.50",
    paymentFee: "27.50",
    otherCosts: "20.00",
    totalCost: "755.00",
    grossProfit: "344.99",
    grossMarginPercent: "31.36",
    ...overrides,
  };
}

function competitor(overrides: Partial<Competitor> = {}): Competitor {
  return {
    id: "C-001",
    product: "Kailh Box Jade",
    brand: "Kailh",
    price: "1099.00",
    currency: "INR",
    marketplace: "Amazon.in",
    url: "https://example.com/listing",
    sourceId: null,
    notes: "",
    observedAt: "2026-09-20T09:00:00.000Z",
    ...overrides,
  };
}

function input(overrides: Partial<CurrencyChangeInput> = {}): CurrencyChangeInput {
  return {
    fromCurrency: "INR",
    toCurrency: "EUR",
    rate: RATE,
    changedAt: CHANGED_AT,
    manifest: manifest(),
    competitors: [competitor()],
    assumptions: assumptions(),
    scenarios: [scenario()],
    snapshots: [],
    ...overrides,
  };
}

function contents(plan: CurrencyChangePlan, path: string): string {
  const found = plan.artifacts.find((entry) => entry.path === path);
  if (found === undefined) throw new Error(`No planned artifact at ${path}`);
  return found.after;
}

describe("planCurrencyChange", () => {
  it("converts the assumptions' amounts and leaves its percentages alone", () => {
    const after = JSON.parse(
      contents(planCurrencyChange(input()), "economics/assumptions.json"),
    ) as CostAssumptions;

    expect(after.acquisitionCost).toBe("5.50");
    expect(after.shippingCost).toBe("0.83");
    expect(after.otherCosts).toBe("0.22");
    expect(after.scenarioPrices.base).toBe("12.10");
    expect(after.currency).toBe("EUR");
    // A fee rate is a percentage of a price, not an amount. Multiplying it by
    // an exchange rate is the failure this whole design exists to prevent.
    expect(after.marketplaceFeeRate).toBe("12.00");
    expect(after.paymentFeeRate).toBe("2.50");
    expect(after.marginThresholdPercent).toBe("20.00");
  });

  it("converts a scenario's amounts and leaves its ratios alone", () => {
    const [converted] = JSON.parse(
      contents(planCurrencyChange(input()), "economics/scenarios.json"),
    ) as EconomicsScenario[];

    expect(converted?.sellingPrice).toBe("12.10");
    expect(converted?.marketplaceFee).toBe("1.45");
    expect(converted?.paymentFee).toBe("0.30");
    expect(converted?.totalCost).toBe("8.31");
    expect(converted?.grossProfit).toBe("3.79");
    // Both of these are dimensionless.
    expect(converted?.marketplaceFeeRate).toBe("12.00");
    expect(converted?.grossMarginPercent).toBe("31.36");
  });

  it("converts a competitor's price and moves its currency code", () => {
    const [converted] = JSON.parse(
      contents(planCurrencyChange(input()), "market/competitors.json"),
    ) as Competitor[];

    expect(converted?.price).toBe("12.09");
    expect(converted?.currency).toBe("EUR");
  });

  it("leaves a null price null rather than turning it into zero", () => {
    const plan = planCurrencyChange(
      input({
        competitors: [competitor(), competitor({ id: "C-002", price: null })],
        assumptions: assumptions({ scenarioPrices: { low: null, base: "10.00", high: null } }),
      }),
    );

    // A price nobody has is not a price of zero, and must not become one.
    expect(plan.oldValues["market/competitors.json#C-002.price"]).toBeUndefined();
    expect(plan.newValues["market/competitors.json#C-002.price"]).toBeUndefined();
    expect(plan.oldValues["economics/assumptions.json#scenarioPrices.low"]).toBeUndefined();
  });

  it("refuses to convert a project into its own currency", () => {
    expect(() => planCurrencyChange(input({ toCurrency: "INR" }))).toThrow(DomainError);
  });

  it("refuses a rate of zero", () => {
    expect(() => planCurrencyChange(input({ rate: "0" }))).toThrow(DomainError);
  });

  it.each(["1e-3", "0x10", "one", "", " 1"])("refuses a rate that is not a decimal: %j", (rate) => {
    expect(() => planCurrencyChange(input({ rate }))).toThrow(DomainError);
  });

  it("rounds half away from zero, once, on emission", () => {
    const plan = planCurrencyChange(
      input({ rate: "0.005", competitors: [competitor({ price: "1.00" })] }),
    );

    expect(plan.newValues["market/competitors.json#C-001.price"]).toBe("0.01");
  });

  it("moves the manifest's currency and bumps its updatedAt", () => {
    const after = JSON.parse(contents(planCurrencyChange(input()), MANIFEST_PATH)) as Manifest;

    expect(after.currency).toBe("EUR");
    expect(after.updatedAt).toBe(CHANGED_AT);
    expect(after.createdAt).toBe("2026-09-01T09:00:00.000Z");
  });

  describe("market snapshots", () => {
    it("converts the listings a snapshot holds", () => {
      const plan = planCurrencyChange(
        input({
          rate: "0.5",
          snapshots: [
            buildMarketSnapshot(
              [competitor({ price: "1000.00" }), competitor({ id: "C-002", price: "2000.00" })],
              "SNAP-20260920T090000Z-abcd",
              "2026-09-20T09:00:00.000Z",
              "",
            ),
          ],
        }),
      );
      const after = JSON.parse(
        contents(plan, "market/snapshots/SNAP-20260920T090000Z-abcd.json"),
      ) as { listings: Competitor[] };

      expect(after.listings.map((listing) => listing.price)).toEqual(["500.00", "1000.00"]);
      expect(after.listings.every((listing) => listing.currency === "EUR")).toBe(true);
    });

    it("recomputes statistics from the converted listings, not from the stored statistic", () => {
      // A real one-cent divergence. The listings convert to 8612.36 and
      // 5568.59, whose mean is 7090.48. Multiplying the snapshot's stored
      // median of 14947.61 by the rate gives 7090.47. A snapshot that stated
      // 7090.47 would be describing a mean its own listings do not have.
      const plan = planCurrencyChange(
        input({
          rate: "0.474355",
          competitors: [],
          snapshots: [
            buildMarketSnapshot(
              [
                competitor({ id: "C-001", price: "18155.94" }),
                competitor({ id: "C-002", price: "11739.28" }),
              ],
              "SNAP-20260920T090000Z-abcd",
              "2026-09-20T09:00:00.000Z",
              "",
            ),
          ],
        }),
      );
      const after = JSON.parse(
        contents(plan, "market/snapshots/SNAP-20260920T090000Z-abcd.json"),
      ) as { statistics: ReturnType<typeof competitorStatistics>; listings: Competitor[] };

      expect(after.statistics.median).toBe("7090.48");
      expect(after.statistics.average).toBe("7090.48");
      expect(after.statistics).toEqual(competitorStatistics(after.listings));
    });

    it("journals the statistics it moved alongside the listings", () => {
      const plan = planCurrencyChange(
        input({
          rate: "0.5",
          snapshots: [
            buildMarketSnapshot(
              [competitor({ price: "1000.00" }), competitor({ id: "C-002", price: "2000.00" })],
              "SNAP-20260920T090000Z-abcd",
              "2026-09-20T09:00:00.000Z",
              "",
            ),
          ],
        }),
      );
      const key = "market/snapshots/SNAP-20260920T090000Z-abcd.json#statistics.median";

      expect(plan.oldValues[key]).toBe("1500.00");
      expect(plan.newValues[key]).toBe("750.00");
    });
  });

  describe("what is planned", () => {
    it("names every value that moved, and nothing that did not", () => {
      const plan = planCurrencyChange(input());
      const moved = Object.keys(plan.newValues);

      expect(moved).toEqual(Object.keys(plan.oldValues));
      expect(plan.newValues).toMatchObject({
        "economics/assumptions.json#acquisitionCost": "5.50",
        "economics/scenarios.json#base.grossProfit": "3.79",
        "market/competitors.json#C-001.price": "12.09",
      });
      expect(moved.some((key) => key.includes("FeeRate"))).toBe(false);
      expect(moved.some((key) => key.includes("MarginPercent"))).toBe(false);
    });

    it("plans only the artifacts a project actually has", () => {
      const plan = planCurrencyChange(input({ scenarios: null, snapshots: [] }));

      expect(plan.artifacts.map((entry) => entry.path)).toEqual([
        "market/competitors.json",
        "economics/assumptions.json",
        MANIFEST_PATH,
      ]);
    });

    it("plans a manifest even when the project has nothing priced", () => {
      // A brand new project has no money anywhere. It still changes its
      // currency, and the preview must be able to say "nothing to convert"
      // rather than refusing to exist.
      const plan = planCurrencyChange(
        input({ competitors: null, assumptions: null, scenarios: null, snapshots: [] }),
      );

      expect(plan.artifacts.map((entry) => entry.path)).toEqual([MANIFEST_PATH]);
      expect(plan.oldValues).toEqual({});
    });

    it("puts the manifest last, so a project is never advertised before it is rewritten", () => {
      const plan = planCurrencyChange(
        input({
          snapshots: [
            buildMarketSnapshot(
              [competitor()],
              "SNAP-20260920T090000Z-abcd",
              "2026-09-20T09:00:00.000Z",
              "",
            ),
          ],
        }),
      );

      expect(plan.artifacts[plan.artifacts.length - 1]?.path).toBe(MANIFEST_PATH);
    });

    it("hashes the artifact set, so adding one artifact changes the hash", () => {
      const one = planCurrencyChange(input());
      const two = planCurrencyChange(
        input({ competitors: [competitor(), competitor({ id: "C-002", price: "50.00" })] }),
      );

      expect(one.beforeHash).toMatch(/^[a-f0-9]{64}$/u);
      expect(one.beforeHash).not.toBe(two.beforeHash);
    });

    it("hashes the same set the same way whatever order it was given in", () => {
      const forwards = planCurrencyChange(input());
      const backwards = planCurrencyChange(input({ scenarios: [...input().scenarios ?? []].reverse() }));
      const extra = planCurrencyChange(input({ scenarios: [] }));

      expect(backwards.beforeHash).toBe(forwards.beforeHash);
      expect(extra.beforeHash).not.toBe(forwards.beforeHash);
    });

    it("is deterministic for a given input", () => {
      expect(JSON.stringify(planCurrencyChange(input()))).toBe(
        JSON.stringify(planCurrencyChange(input())),
      );
    });
  });
});

describe("hashArtifactSet", () => {
  it("ignores the order entries are listed in", () => {
    const a = { path: "a.json", contents: "one" };
    const b = { path: "b.json", contents: "two" };

    expect(hashArtifactSet([a, b])).toBe(hashArtifactSet([b, a]));
  });

  it("notices a single changed byte", () => {
    const a = { path: "a.json", contents: "one" };

    expect(hashArtifactSet([a])).not.toBe(hashArtifactSet([{ ...a, contents: "onf" }]));
  });
});

describe("writeCurrencyPlan", () => {
  async function seed(plan: CurrencyChangePlan): Promise<string> {
    const root = await tempDir();
    for (const entry of plan.artifacts) {
      const path = join(root, ...entry.path.split("/"));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, entry.before, "utf8");
    }
    return root;
  }

  it("writes every artifact and reports what it wrote", async () => {
    const plan = planCurrencyChange(input());
    const root = await seed(plan);

    const written = await writeCurrencyPlan(root, plan);

    expect(written.map((entry) => entry.path).sort()).toEqual(
      plan.artifacts.map((entry) => entry.path).sort(),
    );
    for (const entry of plan.artifacts) {
      expect(await readFile(join(root, ...entry.path.split("/")), "utf8")).toBe(entry.after);
    }
  });

  it("leaves the folder hashing to the hash the plan promised", async () => {
    const plan = planCurrencyChange(input());
    const root = await seed(plan);

    await writeCurrencyPlan(root, plan);

    // This is the check the journal's afterHash is worth: re-reading what was
    // written reproduces the plan's own statement about the project's state.
    const onDisk = await Promise.all(
      plan.artifacts.map(async (entry) => ({
        path: entry.path,
        contents: await readFile(join(root, ...entry.path.split("/")), "utf8"),
      })),
    );
    expect(hashArtifactSet(onDisk)).toBe(plan.afterHash);
  });

  it("writes nothing it was not asked to write", async () => {
    const root = await seed(planCurrencyChange(input()));

    await writeCurrencyPlan(root, planCurrencyChange(input({ scenarios: null })));

    expect(JSON.parse(await readFile(join(root, "economics", "scenarios.json"), "utf8"))).toEqual([
      scenario(),
    ]);
  });

  it("rolls the folder back when a write fails partway through", async () => {
    const plan = planCurrencyChange(input());
    const root = await seed(plan);
    // Make the manifest a directory, so the last write in the plan cannot land.
    const manifestPath = join(root, ...MANIFEST_PATH.split("/"));
    await rm(manifestPath);
    await mkdir(manifestPath);

    await expect(writeCurrencyPlan(root, plan)).rejects.toThrow();

    for (const entry of plan.artifacts.filter((artifact) => artifact.path !== MANIFEST_PATH)) {
      expect(await readFile(join(root, ...entry.path.split("/")), "utf8")).toBe(entry.before);
    }
  });

  it("refuses a plan whose afterHash does not describe its own artifacts", async () => {
    // Verification is not decoration: a plan that claims a state its own
    // contents do not hash to is exactly what a partial write would look like.
    const plan = planCurrencyChange(input());
    const root = await seed(plan);
    const lying: CurrencyChangePlan = { ...plan, afterHash: "f".repeat(64) };

    await expect(writeCurrencyPlan(root, lying)).rejects.toThrow();

    for (const entry of plan.artifacts) {
      expect(await readFile(join(root, ...entry.path.split("/")), "utf8")).toBe(entry.before);
    }
  });

  it("refuses a path outside the known workspace layout", async () => {
    const root = await seed(planCurrencyChange(input()));
    const escaped: CurrencyChangePlan = {
      ...planCurrencyChange(input()),
      artifacts: [{ path: "../../escape.json", before: "a", after: "b" }],
    };

    await expect(writeCurrencyPlan(root, escaped)).rejects.toThrow();
    await expect(readFile(join(root, "..", "..", "escape.json"), "utf8")).rejects.toThrow();
  });
});
