import type {
  CompetitorStatistics,
  EconomicsScenario,
  EvidenceSource,
  Manifest,
  ReportSections,
} from "@open-merchant/shared";

/**
 * Markdown opportunity-report renderer, ported byte-for-byte from the legacy
 * Rust engine so generated reports stay identical across the rewrite.
 */

export interface ReportInput {
  readonly manifest: Manifest;
  readonly sections: ReportSections;
  readonly evidence: EvidenceSource[];
  readonly competitorStatistics: CompetitorStatistics;
  readonly scenarios: EconomicsScenario[];
  readonly runId: string;
  /** RFC 3339 timestamp, already formatted at the edge (e.g. "+00:00" offset). */
  readonly generatedAt: string;
}

const SCENARIO_LABELS: Record<EconomicsScenario["scenario"], string> = {
  low: "Low",
  base: "Base",
  high: "High",
};

export function renderOpportunityReport(input: ReportInput): string {
  const currency = input.manifest.currency;
  const parts: string[] = [];

  parts.push(
    `# ${input.manifest.name}\n\n`,
    `Generated: ${input.generatedAt}\n\n`,
    `## Research objective\n\n${input.manifest.objective}\n\n`,
    `## Decision summary\n\n${orFallback(input.sections.decisionSummary, "No decision summary recorded.")}\n\n`,
  );

  pushListSection(parts, "Market observations", input.sections.marketObservations, "No observations recorded.");

  parts.push("## Competitor price statistics\n\n");
  const stats = input.competitorStatistics;
  if (stats.minimum !== null && stats.maximum !== null && stats.average !== null && stats.median !== null) {
    parts.push(
      `- Priced competitors: ${stats.validPriceCount}\n`,
      `- Price range: ${currency} ${stats.minimum}–${stats.maximum}\n`,
      `- Average price: ${currency} ${stats.average}\n`,
      `- Median price: ${currency} ${stats.median}\n\n`,
    );
  } else {
    parts.push("No valid competitor prices recorded.\n\n");
  }

  parts.push("## Pricing and unit economics\n\n");
  if (input.scenarios.length === 0) {
    parts.push("No scenarios calculated.\n\n");
  } else {
    parts.push("| Scenario | Price | Total cost | Gross profit | Margin |\n|---|---:|---:|---:|---:|\n");
    for (const scenario of input.scenarios) {
      parts.push(
        `| ${SCENARIO_LABELS[scenario.scenario]} | ${currency} ${scenario.sellingPrice} | ${scenario.totalCost} | ${scenario.grossProfit} | ${scenario.grossMarginPercent}% |\n`,
      );
    }
    parts.push("\n");
  }

  pushListSection(parts, "Risks", input.sections.risks, "No risks recorded.");
  pushListSection(parts, "Opportunities", input.sections.opportunities, "No opportunities recorded.");

  parts.push("## Evidence index\n\n");
  if (input.evidence.length === 0) {
    parts.push("No evidence recorded.\n\n");
  } else {
    for (const source of input.evidence) {
      parts.push(`- [${source.id}] [${source.title}](${source.url})\n`);
    }
    parts.push("\n");
  }

  parts.push(`---\nGenerating run: ${input.runId}\n`);
  return parts.join("");
}

function orFallback(value: string, fallback: string): string {
  return value.trim().length === 0 ? fallback : value;
}

function pushListSection(parts: string[], title: string, items: string[], fallback: string): void {
  parts.push(`## ${title}\n\n`);
  if (items.length === 0) {
    parts.push(`${fallback}\n\n`);
  } else {
    for (const item of items) {
      parts.push(`- ${item}\n`);
    }
    parts.push("\n");
  }
}
