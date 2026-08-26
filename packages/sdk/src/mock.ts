import type {
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
 * semantics as the real shell.
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

export function createMockDesktopClient(
  seed: Partial<{ projects: MockProjectState[]; version: string }> = {},
): DesktopClient & { projects: MockProjectState[] } {
  const projects = seed.projects ?? [];
  const now = () => new Date().toISOString();

  return {
    projects,

    appInfo: async () => ({
      appName: "Open Merchant",
      appVersion: seed.version ?? "0.0.0-mock",
      platform: "mock",
    }),

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
      const timestamp = now();
      const state: MockProjectState = {
        snapshot: {
          root: `${parentDirectory.replace(/[\\/]+$/u, "")}/${trimmed.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}`,
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
      const markdown = `# ${project.snapshot.manifest.name}\n\nGenerated: ${now()}\n`;
      project.generatedReport = markdown;
      return { markdown };
    },
    loadGeneratedReport: (root) =>
      Promise.resolve({ markdown: requireProject(projects, root).generatedReport }),

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
  };
}
