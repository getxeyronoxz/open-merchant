import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  conversionRateSchema,
  currencyCodeSchema,
  costAssumptionsSchema,
  competitorSchema,
  economicsScenarioSchema,
  manifestSchema,
  marketSnapshotSchema,
  type ArtifactFingerprint,
  type Competitor,
  type CostAssumptions,
  type EconomicsScenario,
  type Manifest,
  type MarketSnapshot,
} from "@open-merchant/shared";

import { writeFileAtomically } from "./atomic";
import { DomainError } from "./economics";
import { MARKET_SNAPSHOTS_DIR, resolveKnownArtifact, resolveSnapshotPath } from "./layout";
import { Decimal, formatAmount, parseAmount, roundAmount } from "./money";
import { competitorStatistics } from "./statistics";

/**
 * Project currency change (phase 3, roadmap item 6).
 *
 * The seller re-states a whole project in another currency at a rate they enter
 * by hand. There is no network call anywhere in this module: the rate is an
 * input, and the app never has an opinion about what it should be.
 *
 * Two invariants carry the whole design.
 *
 * First, only amounts of money move. A fee rate, a margin percentage and a
 * threshold are dimensionless: they stay exactly as they were, whatever the
 * rate. Multiplying them would be invisible to every validator in the app and
 * wrong in every report.
 *
 * Second, the work is planned before it is written. `planCurrencyChange` is
 * pure — it takes the artifacts as they are and returns their exact converted
 * contents, so the renderer can show a diff of a change that has not happened.
 * `writeCurrencyPlan` then lands that plan or leaves the folder untouched.
 */

export interface CurrencyChangeInput {
  readonly fromCurrency: string;
  readonly toCurrency: string;
  /** New-currency units per one unit of `fromCurrency`. Never inferred. */
  readonly rate: string;
  /** Stamped onto the manifest and the journal record. */
  readonly changedAt: string;
  readonly manifest: Manifest;
  /** null when the project has no such artifact on disk yet. */
  readonly competitors: readonly Competitor[] | null;
  readonly assumptions: CostAssumptions | null;
  readonly scenarios: readonly EconomicsScenario[] | null;
  readonly snapshots: readonly MarketSnapshot[];
}

export interface PlannedArtifact {
  /** Project-relative, exactly as the layout module names it. */
  readonly path: string;
  readonly before: string;
  readonly after: string;
}

export interface CurrencyChangePlan {
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly rate: string;
  readonly changedAt: string;
  /** Manifest last: a project is never advertised as converted before it is. */
  readonly artifacts: readonly PlannedArtifact[];
  /** Every money value that moved, keyed `<artifact path>#<field>`. */
  readonly oldValues: Readonly<Record<string, string>>;
  readonly newValues: Readonly<Record<string, string>>;
  readonly beforeHash: string;
  readonly afterHash: string;
}

const SAME_CURRENCY = "That is already this project's currency";
const BAD_RATE = "Enter the conversion rate as a positive decimal, for example 0.011";

function sha256Hex(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

/**
 * One hash for a whole set of artifacts.
 *
 * A currency change is not a change to any single file, so a per-file hash
 * could not describe it. Entries are sorted by path so the hash depends on the
 * set and not on the order the caller happened to read the folder in.
 */
export function hashArtifactSet(
  entries: readonly { path: string; contents: string }[],
): string {
  const digest = createHash("sha256");
  for (const entry of [...entries].sort((a, b) => a.path.localeCompare(b.path))) {
    digest.update(entry.path).update("\0").update(sha256Hex(entry.contents)).update("\n");
  }
  return digest.digest("hex");
}

/** Validates the two things a caller can get wrong, before anything is read. */
function validateIntent(input: CurrencyChangeInput): Decimal {
  const from = currencyCodeSchema.safeParse(input.fromCurrency);
  if (!from.success) throw new DomainError("This project's currency is not a valid code");
  const to = currencyCodeSchema.safeParse(input.toCurrency);
  if (!to.success) throw new DomainError("Currency must be exactly three uppercase ASCII letters");
  if (to.data === from.data) throw new DomainError(SAME_CURRENCY);
  if (input.manifest.currency !== from.data) {
    // The caller's idea of the current currency and the manifest's disagree.
    // Restating amounts on that basis would produce a project nobody can audit.
    throw new DomainError(
      `This project is in ${input.manifest.currency}, not ${input.fromCurrency}`,
    );
  }
  if (!conversionRateSchema.safeParse(input.rate).success) throw new DomainError(BAD_RATE);
  const rate = new Decimal(input.rate);
  if (rate.lessThanOrEqualTo(0)) throw new DomainError(BAD_RATE);
  return rate;
}

/** Multiply at full precision, round once on emission. */
function convert(raw: string, rate: Decimal): string {
  return formatAmount(roundAmount(parseAmount(raw).times(rate)));
}

/** Collects the before/after pair of every value that actually moves. */
class ValueLedger {
  private readonly old: Record<string, string> = {};
  private readonly next: Record<string, string> = {};

  record(key: string, before: string | null, after: string | null): void {
    if (before === null || after === null || before === after) return;
    this.old[key] = before;
    this.next[key] = after;
  }

  get values(): { oldValues: Record<string, string>; newValues: Record<string, string> } {
    return { oldValues: { ...this.old }, newValues: { ...this.next } };
  }
}

function convertMoneyFields(
  ledger: ValueLedger,
  path: string,
  subject: string,
  fields: Readonly<Record<string, string>>,
  rate: Decimal,
): Record<string, string> {
  const key = (field: string) => `${path}#${subject}${field}`;
  const converted: Record<string, string> = {};
  for (const [field, value] of Object.entries(fields)) {
    const next = convert(value, rate);
    ledger.record(key(field), value, next);
    converted[field] = next;
  }
  return converted;
}

function convertNullable(
  ledger: ValueLedger,
  key: string,
  value: string | null,
  rate: Decimal,
): string | null {
  if (value === null) return null;
  const next = convert(value, rate);
  ledger.record(key, value, next);
  return next;
}

function convertCompetitor(
  ledger: ValueLedger,
  path: string,
  subject: Competitor,
  competitor: Competitor,
  toCurrency: string,
  rate: Decimal,
): Competitor {
  return competitorSchema.parse({
    ...competitor,
    price: convertNullable(ledger, `${path}#${subject.id}.price`, competitor.price, rate),
    currency: toCurrency,
  });
}

function convertAssumptions(
  ledger: ValueLedger,
  value: CostAssumptions,
  toCurrency: string,
  rate: Decimal,
): CostAssumptions {
  const path = "economics/assumptions.json";
  // The three costs and the three selling prices are money. The two fee rates
  // and the margin threshold are percentages and are carried through untouched.
  const amounts = convertMoneyFields(
    ledger,
    path,
    "",
    {
      acquisitionCost: value.acquisitionCost,
      shippingCost: value.shippingCost,
      otherCosts: value.otherCosts,
    },
    rate,
  );
  const prices = {
    low: convertNullable(ledger, `${path}#scenarioPrices.low`, value.scenarioPrices.low, rate),
    base: convertNullable(ledger, `${path}#scenarioPrices.base`, value.scenarioPrices.base, rate),
    high: convertNullable(ledger, `${path}#scenarioPrices.high`, value.scenarioPrices.high, rate),
  };
  return costAssumptionsSchema.parse({ ...value, ...amounts, scenarioPrices: prices, currency: toCurrency });
}

function convertScenario(
  ledger: ValueLedger,
  value: EconomicsScenario,
  rate: Decimal,
): EconomicsScenario {
  const path = "economics/scenarios.json";
  // Fee rates and grossMarginPercent are ratios; the seven amounts are not.
  const amounts = convertMoneyFields(
    ledger,
    path,
    `${value.scenario}.`,
    {
      sellingPrice: value.sellingPrice,
      acquisitionCost: value.acquisitionCost,
      shippingCost: value.shippingCost,
      marketplaceFee: value.marketplaceFee,
      paymentFee: value.paymentFee,
      otherCosts: value.otherCosts,
      totalCost: value.totalCost,
      grossProfit: value.grossProfit,
    },
    rate,
  );
  return economicsScenarioSchema.parse({ ...value, ...amounts });
}

function convertSnapshot(
  ledger: ValueLedger,
  value: MarketSnapshot,
  toCurrency: string,
  rate: Decimal,
): MarketSnapshot {
  const path = `market/snapshots/${value.id}.json`;
  const listings = value.listings.map((listing) =>
    convertCompetitor(ledger, path, listing, listing, toCurrency, rate),
  );
  // Statistics are recomputed from the converted listings rather than
  // multiplied themselves. Each listing was rounded on its own way to two
  // places, so the stored mean describes numbers the file no longer holds; the
  // only mean a snapshot can truthfully state is the one over its own prices.
  const statistics = competitorStatistics(listings);
  for (const field of ["minimum", "maximum", "average", "median"] as const) {
    const before = value.statistics[field];
    if (before === null || statistics[field] === null) continue;
    ledger.record(`${path}#statistics.${field}`, before, statistics[field]);
  }
  return marketSnapshotSchema.parse({
    ...value,
    listings,
    statistics,
    listingCount: listings.length,
  });
}

/** Artifacts are written in the order they are planned; the manifest is last. */
function json(contents: unknown): string {
  return `${JSON.stringify(contents, null, 2)}\n`;
}

/**
 * Computes the whole change without touching the filesystem. Deterministic for
 * a given input — the only clock is the `changedAt` the caller supplies.
 */
export function planCurrencyChange(input: CurrencyChangeInput): CurrencyChangePlan {
  const rate = validateIntent(input);
  const ledger = new ValueLedger();
  const toCurrency = currencyCodeSchema.parse(input.toCurrency);
  const artifacts: PlannedArtifact[] = [];

  if (input.competitors !== null) {
    const path = "market/competitors.json";
    const before = json(input.competitors);
    const competitors = competitorSchema
      .array()
      .parse(input.competitors.map((entry) => convertCompetitor(ledger, path, entry, entry, toCurrency, rate)));
    artifacts.push({ path, before, after: json(competitors) });
  }

  if (input.assumptions !== null) {
    const path = "economics/assumptions.json";
    const before = json(input.assumptions);
    const assumptions = convertAssumptions(ledger, input.assumptions, toCurrency, rate);
    artifacts.push({ path, before, after: json(assumptions) });
  }

  if (input.scenarios !== null) {
    const path = "economics/scenarios.json";
    const before = json(input.scenarios);
    const scenarios = economicsScenarioSchema
      .array()
      .parse(input.scenarios.map((entry) => convertScenario(ledger, entry, rate)));
    artifacts.push({ path, before, after: json(scenarios) });
  }

  for (const snapshot of input.snapshots) {
    const path = `market/snapshots/${snapshot.id}.json`;
    artifacts.push({ path, before: json(snapshot), after: json(convertSnapshot(ledger, snapshot, toCurrency, rate)) });
  }

  if (input.manifest.currency !== input.fromCurrency) {
    // The caller's idea of the current currency and the manifest's disagree.
    // Restating amounts on that basis would produce a project nobody can audit.
    throw new DomainError(
      `This project is in ${input.manifest.currency}, not ${input.fromCurrency}`,
    );
  }
  const manifestPath = ".openmerchant/manifest.json";
  const manifest = manifestSchema.parse({
    ...input.manifest,
    currency: toCurrency,
    updatedAt: input.changedAt,
  });
  artifacts.push({ path: manifestPath, before: json(input.manifest), after: json(manifest) });

  const { oldValues, newValues } = ledger.values;
  return {
    fromCurrency: input.fromCurrency,
    toCurrency: input.toCurrency,
    rate: input.rate,
    changedAt: input.changedAt,
    artifacts,
    oldValues,
    newValues,
    beforeHash: hashArtifactSet(artifacts.map((entry) => ({ path: entry.path, contents: entry.before }))),
    afterHash: hashArtifactSet(artifacts.map((entry) => ({ path: entry.path, contents: entry.after }))),
  };
}

/** Resolves a planned path to an absolute one, refusing anything off-layout. */
async function resolvePlanPath(root: string, relativePath: string): Promise<string> {
  if (relativePath.startsWith(`${MARKET_SNAPSHOTS_DIR}/`)) {
    return resolveSnapshotPath(root, relativePath);
  }
  return resolveKnownArtifact(root, relativePath);
}

/**
 * Lands a plan: writes every artifact, then proves the folder now hashes to the
 * plan's `afterHash`.
 *
 * Any failure — a write that cannot land, or a folder that does not come back
 * as the plan described it — restores the artifacts already written from their
 * captured `before` bytes and throws. A project is left in exactly the state it
 * was in, or in the state the plan promised; never in between.
 *
 * A hard process kill between two writes can still leave a mixed folder. That
 * is loud rather than silent: the project's own validators reject competitors
 * or assumptions whose currency does not match the manifest, so the next read
 * fails instead of showing wrong numbers.
 */
export async function writeCurrencyPlan(
  root: string,
  plan: CurrencyChangePlan,
): Promise<ArtifactFingerprint[]> {
  const written: { artifact: PlannedArtifact; absolute: string }[] = [];
  try {
    for (const artifact of plan.artifacts) {
      const absolute = await resolvePlanPath(root, artifact.path);
      await writeFileAtomically(absolute, artifact.after);
      written.push({ artifact, absolute });
    }
    const onDisk = await Promise.all(
      written.map(async ({ artifact, absolute }) => ({
        path: artifact.path,
        contents: await readFile(absolute, "utf8"),
      })),
    );
    if (hashArtifactSet(onDisk) !== plan.afterHash) {
      throw new Error("The project folder did not come back as the plan described it");
    }
  } catch (error) {
    for (const { artifact, absolute } of [...written].reverse()) {
      await writeFileAtomically(absolute, artifact.before).catch(() => undefined);
    }
    throw error;
  }
  return plan.artifacts.map((artifact) => ({ path: artifact.path, sha256: sha256Hex(artifact.after) }));
}
