import type {
  AiOrigin,
  Competitor,
  CompetitorStatistics,
  CostAssumptions,
  EconomicsScenario,
  EvidenceSource,
  ListingPriceHistory,
  MarginFlag,
  MarketSnapshot,
  ProjectSnapshot,
  ReportSections,
  SnapshotDiff,
} from "@open-merchant/shared";
import { AppError, emptyReportSections } from "@open-merchant/shared";

import type { DesktopClient } from "./client";

/**
 * In-memory DesktopClient for Vitest and renderer development outside
 * Electron. State lives entirely in memory with the same coded-error
 * semantics as the real shell. AI drafts are deterministic placeholders.
 */

export interface MockProjectState {
  snapshot: ProjectSnapshot;
  evidence: EvidenceSource[];
  competitors: Competitor[];
  marketSnapshots: MarketSnapshot[];
  assumptions: CostAssumptions | null;
  scenarios: EconomicsScenario[];
  sections: ReportSections;
  generatedReport: string | null;
}

export function emptyMockAssumptions(currency: string): CostAssumptions {
  return {
    currency,
    acquisitionCost: "0.00",
    shippingCost: "0.00",
    marketplaceFeeRate: "0.00",
    paymentFeeRate: "0.00",
    otherCosts: "0.00",
    scenarioPrices: { low: null, base: null, high: null },
    marginThresholdPercent: null,
  };
}

/**
 * Lowercase-hyphenated folder slug, built with bounded character loops —
 * no regex over uncontrolled input (mirrors core's projectFolderName).
 */
function slugify(value: string): string {
  let slug = "";
  let previousWasSeparator = false;
  for (const character of value.trim().toLowerCase()) {
    const isSlugCharacter =
      (character >= "a" && character <= "z") || (character >= "0" && character <= "9");
    if (isSlugCharacter) {
      slug += character;
      previousWasSeparator = false;
    } else if (!previousWasSeparator && slug.length > 0) {
      slug += "-";
      previousWasSeparator = true;
    }
  }
  let start = 0;
  while (start < slug.length && slug[start] === "-") start += 1;
  return slug.slice(start) || "project";
}

const EMPTY_STATS: CompetitorStatistics = {
  validPriceCount: 0,
  minimum: null,
  maximum: null,
  average: null,
  median: null,
};

/** Dev/test-only statistics over money strings; mirrors core's rounding shape. */
function mockCompetitorStatistics(competitors: Competitor[]): CompetitorStatistics {
  const prices = competitors
    .map((competitor) => competitor.price)
    .filter((price): price is NonNullable<typeof price> => price !== null)
    .map(Number)
    .sort((a, b) => a - b);
  if (prices.length === 0) return EMPTY_STATS;
  const sum = prices.reduce((total, price) => total + price, 0);
  const lower = prices[Math.floor((prices.length - 1) / 2)] as number;
  const upper = prices[Math.ceil((prices.length - 1) / 2)] as number;
  return {
    validPriceCount: prices.length,
    minimum: (prices[0] as number).toFixed(2),
    maximum: (prices[prices.length - 1] as number).toFixed(2),
    average: (sum / prices.length).toFixed(2),
    median: ((lower + upper) / 2).toFixed(2),
  };
}

function requireProject(projects: MockProjectState[], root: string): MockProjectState {
  const found = projects.find((project) => project.snapshot.root === root);
  if (!found) {
    throw new AppError({
      code: "not-a-project",
      message: "That folder is not an Open Merchant project.",
    });
  }
  return found;
}

/** Mock margin flags: shared by marginMonitor and the portfolio overview. */
function mockMarginFlags(project: MockProjectState): MarginFlag[] {
  const assumptions = project.assumptions;
  const latest = project.marketSnapshots[0] ?? null;
  const marketPrice = latest?.statistics.median ?? null;
  const threshold = assumptions?.marginThresholdPercent ?? null;
  if (!assumptions) return [];
  const flags: MarginFlag[] = [];
  for (const scenario of project.scenarios) {
    const current = Number(scenario.grossMarginPercent);
    let marginAtMarket: number | null = null;
    if (marketPrice !== null) {
      const price = Number(marketPrice);
      const totalCost =
        Number(assumptions.acquisitionCost) +
        Number(assumptions.shippingCost) +
        (price * Number(assumptions.marketplaceFeeRate)) / 100 +
        (price * Number(assumptions.paymentFeeRate)) / 100 +
        Number(assumptions.otherCosts);
      marginAtMarket = price > 0 ? ((price - totalCost) / price) * 100 : null;
    }
    let status: "healthy" | "watch" | "breached" | "unmonitored" = "unmonitored";
    if (threshold !== null && marginAtMarket !== null) {
      const limit = Number(threshold);
      status =
        marginAtMarket < limit ? "breached" : marginAtMarket < limit + 5 ? "watch" : "healthy";
    }
    flags.push({
      scenario: scenario.scenario,
      sellingPrice: scenario.sellingPrice,
      grossMarginPercent: scenario.grossMarginPercent,
      marginAtMarketPrice: marginAtMarket === null ? null : marginAtMarket.toFixed(2),
      driftPercent: marginAtMarket === null ? null : (marginAtMarket - current).toFixed(2),
      status,
    });
  }
  return flags;
}

function mockWorstStatus(
  flags: readonly { status: "healthy" | "watch" | "breached" | "unmonitored" }[],
): "healthy" | "watch" | "breached" | "none" {
  if (flags.length === 0) return "none";
  if (flags.some((flag) => flag.status === "breached")) return "breached";
  if (flags.some((flag) => flag.status === "watch")) return "watch";
  return "healthy";
}

const MOCK_ORIGIN: AiOrigin = {
  kind: "agent",
  agentId: "mock-agent",
  providerId: "mock",
  modelId: "mock-deterministic",
  promptHash: "0".repeat(64),
};

export function createMockDesktopClient(
  seed: Partial<{ projects: MockProjectState[]; version: string }> = {},
): DesktopClient & { projects: MockProjectState[] } {
  const projects = seed.projects ?? [];
  const now = () => new Date().toISOString();
  const historyByProject = new Map<string, Record<"scenarios" | "report", Map<string, string>>>();
  let snapshotCounter = 0;
  let mockSnapshotCounter = 0;

  const saveSnapshot = (root: string, kind: "scenarios" | "report", contents: string): void => {
    const runId = `RUN-mock-${String(snapshotCounter++).padStart(4, "0")}`;
    let byKind = historyByProject.get(root);
    if (!byKind) {
      byKind = { scenarios: new Map(), report: new Map() };
      historyByProject.set(root, byKind);
    }
    byKind[kind].set(runId, contents);
  };

  const client: DesktopClient & { projects: MockProjectState[] } = {
    projects,

    appInfo: async () => ({
      appName: "Open Merchant",
      appVersion: seed.version ?? "0.0.0-mock",
      platform: "mock",
    }),

    installUpdate: async () => {
      // The mock has no updater; nothing to install.
      return { quitting: false };
    },

    chooseDirectory: async (title) => {
      void title;
      // Browser development convenience: pretend the user picked a folder.
      return { path: "C:/Users/demo/research" };
    },

    createProject: async ({ parentDirectory, name, objective, currency }) => {
      const trimmed = name.trim();
      if (!trimmed || !parentDirectory.trim()) {
        throw new AppError({ code: "invalid-input", message: "Name and location are required." });
      }
      if (!/^[A-Z]{3}$/u.test(currency)) {
        throw new AppError({ code: "invalid-input", message: "Currency must be three uppercase letters." });
      }
      if (projects.some((project) => project.snapshot.manifest.name === trimmed)) {
        throw new AppError({ code: "already-exists", message: `A project named ${trimmed} already exists.` });
      }
      let parentTrimmed = parentDirectory;
      while (parentTrimmed.endsWith("/") || parentTrimmed.endsWith("\\")) {
        parentTrimmed = parentTrimmed.slice(0, -1);
      }
      const timestamp = now();
      const state: MockProjectState = {
        snapshot: {
          root: `${parentTrimmed}/${slugify(trimmed)}`,
          manifest: {
            schemaVersion: 2,
            projectId: crypto.randomUUID(),
            name: trimmed,
            objective: objective.trim(),
            currency,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        },
        evidence: [],
        competitors: [],
        marketSnapshots: [],
        assumptions: emptyMockAssumptions(currency),
        scenarios: [],
        sections: emptyReportSections(),
        generatedReport: null,
      };
      projects.push(state);
      return { snapshot: state.snapshot };
    },

    openProject: async ({ root }) => ({ snapshot: requireProject(projects, root).snapshot }),

    saveManifest: async (root, manifest) => {
      const project = requireProject(projects, root);
      const updated = {
        ...project.snapshot.manifest,
        name: manifest.name.trim() || project.snapshot.manifest.name,
        objective: manifest.objective,
        updatedAt: new Date().toISOString(),
      };
      project.snapshot = { root: project.snapshot.root, manifest: updated };
      return { snapshot: project.snapshot };
    },

    importV0Project: async () => {
      throw new AppError({ code: "not-found", message: "Import is unavailable in the mock client." });
    },

    listRecents: async () => ({
      projects: projects.map((project) => ({
        name: project.snapshot.manifest.name,
        path: project.snapshot.root,
        lastOpenedAt: project.snapshot.manifest.updatedAt,
      })),
    }),

    removeRecent: async ({ path }) => {
      const index = projects.findIndex((project) => project.snapshot.root === path);
      if (index >= 0) projects.splice(index, 1);
      return {};
    },

    loadEvidence: (root) => Promise.resolve({ sources: requireProject(projects, root).evidence }),
    saveEvidence: async (root, sources) => {
      requireProject(projects, root).evidence = sources;
      return {};
    },

    loadCompetitors: (root) => Promise.resolve({ competitors: requireProject(projects, root).competitors }),
    saveCompetitors: async (root, competitors) => {
      requireProject(projects, root).competitors = competitors;
      return {};
    },

    competitorStatistics: async (root) => ({
      statistics: mockCompetitorStatistics(requireProject(projects, root).competitors),
    }),

    captureMarketSnapshot: async (root, note) => {
      const project = requireProject(projects, root);
      await Promise.resolve();
      const stamp = new Date();
      const pad = (value: number, length: number): string => String(value).padStart(length, "0");
      const id =
        `SNAP-${pad(stamp.getUTCFullYear(), 4)}${pad(stamp.getUTCMonth() + 1, 2)}${pad(stamp.getUTCDate(), 2)}` +
        `T${pad(stamp.getUTCHours(), 2)}${pad(stamp.getUTCMinutes(), 2)}${pad(stamp.getUTCSeconds(), 2)}Z-` +
        `${mockSnapshotCounter.toString(16).padStart(4, "0")}`;
      mockSnapshotCounter += 1;
      const capturedAt = stamp.toISOString();
      const snapshot: MarketSnapshot = {
        id,
        capturedAt,
        note,
        listingCount: project.competitors.length,
        statistics: mockCompetitorStatistics(project.competitors),
        listings: project.competitors.map((competitor) => ({ ...competitor })),
      };
      project.marketSnapshots.unshift(snapshot);
      return { snapshot };
    },
    listMarketSnapshots: async (root) => ({
      snapshots: requireProject(projects, root).marketSnapshots.map((snapshot) => ({ ...snapshot })),
    }),
    snapshotDiff: async (root, fromId, toId) => {
      const snapshots = requireProject(projects, root).marketSnapshots;
      const from = snapshots.find((snapshot) => snapshot.id === fromId);
      const to = snapshots.find((snapshot) => snapshot.id === toId);
      if (!from) {
        throw new AppError({ code: "not-found", message: `Market snapshot not found: ${fromId}` });
      }
      if (!to) {
        throw new AppError({ code: "not-found", message: `Market snapshot not found: ${toId}` });
      }
      const keyOf = (listing: Competitor): string =>
        [listing.brand, listing.product, listing.marketplace]
          .map((value) => value.trim().toLowerCase())
          .join(" | ");
      const fromByKey = new Map(from.listings.map((listing) => [keyOf(listing), listing]));
      const toByKey = new Map(to.listings.map((listing) => [keyOf(listing), listing]));
      const added = to.listings.filter((listing) => !fromByKey.has(keyOf(listing)));
      const removed = from.listings.filter((listing) => !toByKey.has(keyOf(listing)));
      const priceChanges: SnapshotDiff["priceChanges"] = [];
      for (const [key, next] of toByKey) {
        const previous = fromByKey.get(key);
        if (!previous || previous.price === next.price) continue;
        priceChanges.push({
          key,
          product: next.product,
          brand: next.brand,
          marketplace: next.marketplace,
          fromPrice: previous.price,
          toPrice: next.price,
        });
      }
      const diff: SnapshotDiff = { fromId: from.id, toId: to.id, added, removed, priceChanges };
      return { diff };
    },
    listingPriceHistory: async (root) => {
      const snapshots = [...requireProject(projects, root).marketSnapshots].reverse();
      const byKey = new Map<string, ListingPriceHistory>();
      for (const snapshot of snapshots) {
        for (const listing of snapshot.listings) {
          const key = [listing.brand, listing.product, listing.marketplace]
            .map((value) => value.trim().toLowerCase())
            .join(" | ");
          let entry = byKey.get(key);
          if (!entry) {
            entry = {
              key,
              product: listing.product,
              brand: listing.brand,
              marketplace: listing.marketplace,
              points: [],
            };
            byKey.set(key, entry);
          }
          entry.points.push({
            snapshotId: snapshot.id,
            capturedAt: snapshot.capturedAt,
            price: listing.price,
          });
        }
      }
      return { history: [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key)) };
    },

    marginMonitor: async (root) => {
      const project = requireProject(projects, root);
      await Promise.resolve();
      const latest = project.marketSnapshots[0] ?? null;
      return {
        monitor: {
          thresholdPercent: project.assumptions?.marginThresholdPercent ?? null,
          marketPrice: latest?.statistics.median ?? null,
          marketSource: latest?.id ?? null,
          flags: mockMarginFlags(project),
        },
      };
    },

    decisionJournal: async (root) => {
      const project = requireProject(projects, root);
      await Promise.resolve();
      const now = new Date();
      const staleAfterMs = 30 * 24 * 60 * 60 * 1000;
      const staleEvidence = project.evidence
        .map((source) => ({
          id: source.id,
          title: source.title,
          observedAt: source.observedAt,
          ageDays: Math.max(
            0,
            Math.floor((now.getTime() - Date.parse(source.observedAt)) / 86_400_000),
          ),
        }))
        .filter((entry) => now.getTime() - Date.parse(entry.observedAt) > staleAfterMs)
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
      // The mock tracks no runs; report entries exist only in the real shell.
      return { journal: { entries: [], staleEvidence, staleAfterDays: 30 } };
    },

    exportCsv: async (root, kind) => {
      const project = requireProject(projects, root);
      await Promise.resolve();
      const rows: string[][] =
        kind === "competitors"
          ? [["id", "product", "brand", "price", "currency", "marketplace", "url", "notes"],
             ...project.competitors.map((c) => [c.id, c.product, c.brand, c.price ?? "", c.currency, c.marketplace, c.url, c.notes])]
          : kind === "evidence"
            ? [["id", "title", "url", "observedAt"],
               ...project.evidence.map((s) => [s.id, s.title, s.url, s.observedAt])]
            : [["scenario", "sellingPrice", "totalCost", "grossProfit", "grossMarginPercent"],
               ...project.scenarios.map((s) => [s.scenario, s.sellingPrice, s.totalCost, s.grossProfit, s.grossMarginPercent])];
      return {
        csv: rows.map((row) => row.map((field) => (/[",\n]/u.test(field) ? `"${field}"` : field)).join(",")).join("\n"),
        filename: `mock-${kind}.csv`,
      };
    },
    parseCsv: async (csv) => {
      await Promise.resolve();
      const lines = csv.split(/\r?\n/u).filter((line) => line.trim().length > 0);
      const [header] = lines;
      return { headers: (header ?? "").split(","), rowCount: Math.max(0, lines.length - 1) };
    },
    importCompetitorsCsv: async (root, csv) => {
      const project = requireProject(projects, root);
      await Promise.resolve();
      const lines = csv.split(/\r?\n/u).filter((line) => line.trim().length > 0);
      const [header, ...dataRows] = lines;
      const columns = (header ?? "").split(",");
      const productIndex = columns.findIndex((name) => name.trim().toLowerCase() === "product");
      const priceIndex = columns.findIndex((name) => name.trim().toLowerCase() === "price");
      if (productIndex < 0) {
        throw new AppError({ code: "invalid-input", message: "Map the product column to import competitors" });
      }
      const errors: { row: number; message: string }[] = [];
      let imported = 0;
      dataRows.forEach((line, index) => {
        const cells = line.split(",");
        const product = (cells[productIndex] ?? "").trim();
        if (product.length === 0) {
          errors.push({ row: index + 2, message: "Product name is required" });
          return;
        }
        const rawPrice = (cells[priceIndex] ?? "").trim();
        let price: string | null = null;
        if (rawPrice.length > 0 && !/^\d+(\.\d{1,2})?$/u.test(rawPrice)) {
          errors.push({ row: index + 2, message: `Price "${rawPrice}" is not a valid amount` });
          return;
        }
        price = rawPrice.length > 0 ? rawPrice : null;
        project.competitors.push({
          id: `C-${String(project.competitors.length + 1).padStart(3, "0")}`,
          product,
          brand: "",
          price,
          currency: project.snapshot.manifest.currency,
          marketplace: "",
          url: "",
          sourceId: null,
          notes: "Imported from CSV (mock)",
          observedAt: new Date().toISOString(),
        });
        imported += 1;
      });
      return { imported, skipped: errors.length, errors };
    },
    createArchive: async () => {
      throw new AppError({ code: "not-found", message: "Archives are available in the desktop app." });
    },
    restoreArchive: async () => {
      throw new AppError({ code: "not-found", message: "Archives are available in the desktop app." });
    },
    exportReportPdf: async () => {
      throw new AppError({ code: "not-found", message: "PDF export is available in the desktop app." });
    },

    portfolioOverview: async () => {
      await Promise.resolve();
      const severity = { breached: 0, watch: 1, healthy: 2, none: 3 } as const;
      const entries = projects.map((project) => {
        const flags = mockMarginFlags(project)
          .filter(
            (flag): flag is MarginFlag & { status: "healthy" | "watch" | "breached" } =>
              flag.status !== "unmonitored",
          )
          .map(({ scenario, status }) => ({
            scenario,
            status,
          }));
        const latest = project.marketSnapshots[0] ?? null;
        return {
          root: project.snapshot.root,
          name: project.snapshot.manifest.name,
          currency: project.snapshot.manifest.currency,
          hasReport: project.generatedReport !== null,
          lastReportAt: null,
          snapshotCapturedAt: latest?.capturedAt ?? null,
          snapshotAgeDays:
            latest === null
              ? null
              : Math.max(0, Math.floor((Date.now() - Date.parse(latest.capturedAt)) / 86_400_000)),
          thresholdPercent: project.assumptions?.marginThresholdPercent ?? null,
          worstStatus: mockWorstStatus(flags),
          flags,
        };
      });
      return {
        projects: entries.sort(
          (a, b) =>
            severity[a.worstStatus] - severity[b.worstStatus] || a.name.localeCompare(b.name),
        ),
      };
    },

    loadAssumptions: (root) => {
      const project = requireProject(projects, root);
      if (!project.assumptions) {
        throw new AppError({ code: "not-found", message: "No assumptions saved yet." });
      }
      return Promise.resolve({ assumptions: project.assumptions });
    },
    saveAssumptions: async (root, assumptions) => {
      requireProject(projects, root).assumptions = assumptions;
      return {};
    },

    calculateScenarios: async (root) => {
      const project = requireProject(projects, root);
      const assumptions = project.assumptions;
      if (!assumptions) {
        throw new AppError({ code: "invalid-input", message: "Save assumptions before calculating." });
      }
      const scenarios: EconomicsScenario[] = [];
      for (const key of ["low", "base", "high"] as const) {
        const priceRaw = assumptions.scenarioPrices[key];
        if (priceRaw === null) {
          throw new AppError({
            code: "invalid-input",
            message: "Every selling-price scenario must be provided.",
          });
        }
        // The mock is for UI development only; exact math lives in core.
        const price = Number(priceRaw);
        const fee = (price * Number(assumptions.marketplaceFeeRate)) / 100;
        const payFee = (price * Number(assumptions.paymentFeeRate)) / 100;
        const total =
          Number(assumptions.acquisitionCost) +
          Number(assumptions.shippingCost) +
          fee +
          payFee +
          Number(assumptions.otherCosts);
        const profit = price - total;
        scenarios.push({
          scenario: key,
          sellingPrice: price.toFixed(2),
          acquisitionCost: assumptions.acquisitionCost,
          shippingCost: assumptions.shippingCost,
          marketplaceFeeRate: assumptions.marketplaceFeeRate,
          marketplaceFee: fee.toFixed(2),
          paymentFeeRate: assumptions.paymentFeeRate,
          paymentFee: payFee.toFixed(2),
          otherCosts: assumptions.otherCosts,
          totalCost: total.toFixed(2),
          grossProfit: profit.toFixed(2),
          grossMarginPercent: ((profit / price) * 100).toFixed(2),
        });
      }
      project.scenarios = scenarios;
      saveSnapshot(root, "scenarios", `${JSON.stringify(scenarios, null, 2)}\n`);
      return { scenarios };
    },
    loadScenarios: (root) => Promise.resolve({ scenarios: requireProject(projects, root).scenarios }),

    loadReportSections: (root) => Promise.resolve({ sections: requireProject(projects, root).sections }),
    saveReportSections: async (root, sections) => {
      requireProject(projects, root).sections = sections;
      return {};
    },

    generateReport: async (root) => {
      const project = requireProject(projects, root);
      await Promise.resolve();
      const { manifest } = project.snapshot;
      const prices = project.competitors
        .map((competitor) => competitor.price)
        .filter((price): price is NonNullable<typeof price> => price !== null)
        .map(Number)
        .sort((a, b) => a - b);
      const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
      const stats =
        prices.length === 0
          ? "No valid competitor prices recorded."
          : [
              `- Priced competitors: ${prices.length}`,
              `- Price range: ${manifest.currency} ${prices[0]?.toFixed(2)}–${prices[prices.length - 1]?.toFixed(2)}`,
              `- Average price: ${manifest.currency} ${(sum(prices) / prices.length).toFixed(2)}`,
            ].join("\n");
      const scenarioRows = project.scenarios
        .map(
          (scenario) =>
            `| ${scenario.scenario.charAt(0).toUpperCase()}${scenario.scenario.slice(1)} | ${manifest.currency} ${scenario.sellingPrice} | ${scenario.totalCost} | ${scenario.grossProfit} | ${scenario.grossMarginPercent}% |`,
        )
        .join("\n");
      const evidence = project.evidence
        .map((source) => `- [${source.id}] [${source.title}](${source.url})`)
        .join("\n");
      // Demo-grade report for browser development; the real engine lives in
      // packages/core and runs inside the Electron shell.
      const markdown = [
        `# ${manifest.name}`,
        "",
        `Generated: ${now()}`,
        "",
        "## Research objective",
        "",
        manifest.objective,
        "",
        "## Decision summary",
        "",
        project.sections.decisionSummary || "No decision summary recorded.",
        "",
        "## Competitor price statistics",
        "",
        stats,
        "",
        "## Pricing and unit economics",
        "",
        "| Scenario | Price | Total cost | Gross profit | Margin |",
        "|---|---:|---:|---:|---:|",
        scenarioRows || "No scenarios calculated.",
        "",
        "## Evidence index",
        "",
        evidence || "No evidence recorded.",
        "",
      ].join("\n");
      project.generatedReport = markdown;
      saveSnapshot(root, "report", markdown);
      return { markdown };
    },
    loadGeneratedReport: (root) =>
      Promise.resolve({ markdown: requireProject(projects, root).generatedReport }),

    readHistory: async (root, kind, runId) => {
      requireProject(projects, root);
      return { text: historyByProject.get(root)?.[kind]?.get(runId) ?? null };
    },

    listArtifacts: async (root) => {
      const project = requireProject(projects, root);
      return {
        artifacts: [
          { path: ".openmerchant/manifest.json", exists: true },
          { path: "evidence/sources.jsonl", exists: project.evidence.length > 0 },
          { path: "market/competitors.json", exists: project.competitors.length > 0 },
          { path: "economics/scenarios.json", exists: project.scenarios.length > 0 },
          { path: "reports/opportunity-report.md", exists: project.generatedReport !== null },
        ],
      };
    },
    readArtifact: async (root, relativePath) => {
      const project = requireProject(projects, root);
      if (relativePath.endsWith("opportunity-report.md")) {
        return { text: project.generatedReport ?? "" };
      }
      return { text: "" };
    },
    listRuns: () => Promise.resolve({ runs: [] }),
    listProvenance: () => Promise.resolve({ provenance: [] }),

    loadAiConfig: async () => ({
      activeProvider: null,
      models: { anthropic: "claude-sonnet-4-5", openai: "gpt-4o" },
      hasKeys: {},
      baseUrls: {},
      encryptionAvailable: true,
    }),
    saveAiConfig: async (_request) => {
      await Promise.resolve();
      return {};
    },
    testAi: async (providerId) => {
      await Promise.resolve();
      return { reply: `ready (${providerId} mock)` };
    },
    draftEvidence: async (root, url, pageText) => {
      const project = requireProject(projects, root);
      const nextId = nextMockId(
        project.evidence.map((source) => source.id),
        "S",
      );
      const timestamp = now();
      return {
        draft: {
          id: nextId,
          url,
          title: `Draft from ${new URL(url).host}`,
          notes: pageText.slice(0, 200),
          observations: [
            { id: "O-1", label: "Mock observation", value: "0.00", unit: null, note: "" },
          ],
          observedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        origin: MOCK_ORIGIN,
      };
    },
    draftSections: async (root) => {
      requireProject(projects, root);
      await Promise.resolve();
      return {
        sections: {
          decisionSummary:
            "[mock draft] Review the recorded evidence and scenarios, then edit this summary.",
          marketObservations: ["[mock draft] Replace with a grounded observation."],
          risks: ["[mock draft] Replace with a grounded risk."],
          opportunities: ["[mock draft] Replace with a grounded opportunity."],
        },
        origin: MOCK_ORIGIN,
      };
    },
    draftPlan: async (root) => {
      requireProject(projects, root);
      await Promise.resolve();
      return {
        plan: {
          steps: [
            { title: "[mock] Collect five comparable listings", why: "Ground the price range." },
            { title: "[mock] Confirm landed cost with a supplier", why: "Validate assumptions." },
          ],
        },
        origin: MOCK_ORIGIN,
      };
    },
    draftCompetitors: async (root, pastedListings) => {
      requireProject(projects, root);
      await Promise.resolve();
      void pastedListings;
      return {
        competitors: [
          {
            product: "[mock] Draft listing",
            brand: "",
            price: "0.00",
            marketplace: "",
            url: "",
          },
        ],
        origin: MOCK_ORIGIN,
      };
    },
    reviewEconomics: async (root) => {
      requireProject(projects, root);
      await Promise.resolve();
      return {
        review: {
          verdict: "caution",
          summary: "[mock] Review output — replace by configuring a provider.",
          findings: [{ severity: "info", message: "Mock review found nothing to flag." }],
        },
        origin: MOCK_ORIGIN,
      };
    },
    auditReport: async (root) => {
      requireProject(projects, root);
      await Promise.resolve();
      return {
        audit: {
          verdict: "gaps-found",
          summary: "[mock] Audit output — replace by configuring a provider.",
          findings: [
            { status: "unverified", claim: "[mock] Example claim", note: "No matching evidence." },
          ],
        },
        origin: MOCK_ORIGIN,
      };
    },
  };
  return client;
}

function nextMockId(existing: readonly string[], prefix: string): string {
  let highest = 0;
  for (const id of existing) {
    const match = new RegExp(`^${prefix}-(\\d+)$`, "u").exec(id);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}
