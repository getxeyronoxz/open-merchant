import type {
  AiOrigin,
  Competitor,
  CompetitorStatistics,
  CostAssumptions,
  EconomicsScenario,
  EvidenceSource,
  ProjectSnapshot,
  ReportSections,
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

    competitorStatistics: async (root) => {
      const prices = requireProject(projects, root)
        .competitors.map((competitor) => competitor.price)
        .filter((price): price is NonNullable<typeof price> => price !== null)
        .map(Number)
        .sort((a, b) => a - b);
      if (prices.length === 0) return { statistics: EMPTY_STATS };
      const sum = prices.reduce((total, price) => total + price, 0);
      const lower = prices[Math.floor((prices.length - 1) / 2)] as number;
      const upper = prices[Math.ceil((prices.length - 1) / 2)] as number;
      return {
        statistics: {
          validPriceCount: prices.length,
          minimum: (prices[0] as number).toFixed(2),
          maximum: (prices[prices.length - 1] as number).toFixed(2),
          average: (sum / prices.length).toFixed(2),
          median: ((lower + upper) / 2).toFixed(2),
        },
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
