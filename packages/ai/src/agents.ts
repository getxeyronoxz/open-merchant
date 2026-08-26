import { z } from "zod";

import type {
  AuditReport,
  Competitor,
  CompetitorDraft,
  CompetitorStatistics,
  CostAssumptions,
  EconomicsReview,
  EconomicsScenario,
  EvidenceSource,
  ReportSections,
  ResearchPlan,
} from "@open-merchant/shared";
import {
  auditReportSchema,
  competitorDraftListSchema,
  economicsReviewSchema,
  evidenceSourceSchema,
  reportSectionsSchema,
  researchPlanSchema,
} from "@open-merchant/shared";

import type { CompletionResult, LlmProvider } from "./providers";

/**
 * Specialist agents. Each one turns project context into a *draft* the
 * human must review and accept — never a direct write. Outputs are strict
 * JSON validated against shared schemas; malformed model output is an
 * error, not a guess.
 */

export class AiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiParseError";
  }
}

/** Pulls the first JSON object out of a model response defensively. */
function parseJsonObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/u.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AiParseError("Model response contained no JSON object");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (error) {
    throw new AiParseError(
      `Model returned malformed JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const NO_INVENTION = [
  "Rules:",
  "- Use only facts present in the provided material; never invent prices, dates, or claims.",
  '- If information is missing, use "" or omit optional entries rather than guessing.',
  "- Respond with a single JSON object and nothing else.",
].join("\n");

// --- Evidence assistant ------------------------------------------------------

export interface DraftEvidenceInput {
  readonly nextId: string;
  readonly url: string;
  /** The user pastes the listing/page content — no autonomous scraping in phase 1. */
  readonly pageText: string;
}

export interface AgentDraft<T> {
  readonly value: T;
  readonly completion: CompletionResult;
}

export async function draftEvidenceSource(
  provider: LlmProvider,
  input: DraftEvidenceInput,
): Promise<AgentDraft<EvidenceSource>> {
  const system = [
    "You are the evidence assistant inside a commerce research workspace.",
    "From the user's pasted page material, produce ONE structured evidence source.",
    NO_INVENTION,
  ].join("\n");

  const prompt = [
    `Assign this source the id "${input.nextId}".`,
    `Source URL: ${input.url}`,
    "Pasted page material follows, between the markers.",
    "--- BEGIN MATERIAL ---",
    input.pageText,
    "--- END MATERIAL ---",
    "",
    'Return JSON matching: {"id":string,"url":string,"title":string,"notes":string,"observations":[{"id":string,"label":string,"value":string,"unit":string|null}]}',
    "Observation ids are O-1, O-2, … Include only concrete observed values worth recording.",
  ].join("\n");

  const completion = await provider.complete({ system, prompt });
  const parsed = z
    .object({
      id: z.string(),
      url: z.string(),
      title: z.string(),
      notes: z.string().default(""),
      observations: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          value: z.string(),
          unit: z.string().nullable(),
        }),
      ),
    })
    .parse(parseJsonObject(completion.text));

  const now = new Date().toISOString();
  const draft = evidenceSourceSchema.parse({
    id: input.nextId,
    url: parsed.url.startsWith("http") ? parsed.url : input.url,
    title: parsed.title.trim() || "Untitled source",
    notes: parsed.notes,
    observations: parsed.observations.map((observation) => ({ ...observation, note: "" })),
    observedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return { value: draft, completion };
}

// --- Report writer -----------------------------------------------------------

export interface DraftSectionsInput {
  readonly objective: string;
  readonly currency: string;
  readonly evidence: Pick<EvidenceSource, "id" | "title" | "notes">[];
  readonly competitors: Pick<Competitor, "id" | "product" | "price" | "marketplace">[];
  readonly statistics: CompetitorStatistics;
  readonly assumptions: CostAssumptions;
  readonly scenarios: EconomicsScenario[];
  readonly existingSections?: ReportSections;
}

export async function draftReportSections(
  provider: LlmProvider,
  input: DraftSectionsInput,
): Promise<AgentDraft<ReportSections>> {
  const system = [
    "You are the report writer inside a commerce research workspace.",
    "You draft decision-summary sections from the user's own recorded research.",
    NO_INVENTION,
    "Write plainly and specifically; no hedging filler, no marketing voice.",
  ].join("\n");

  const prompt = [
    `Research objective: ${input.objective}`,
    `Currency: ${input.currency}`,
    "",
    "Evidence sources:",
    ...input.evidence.map((source) => `- [${source.id}] ${source.title}${source.notes ? `: ${source.notes}` : ""}`),
    "",
    "Competitor listings:",
    ...input.competitors.map(
      (competitor) =>
        `- [${competitor.id}] ${competitor.product} @ ${competitor.marketplace}: ${
          competitor.price ?? "unpriced"
        }`,
    ),
    "",
    `Price statistics: ${JSON.stringify(input.statistics)}`,
    `Cost assumptions: ${JSON.stringify(input.assumptions)}`,
    `Calculated scenarios: ${JSON.stringify(input.scenarios)}`,
    input.existingSections
      ? `\nThe user already drafted these sections; improve rather than replace their meaning:\n${JSON.stringify(input.existingSections)}`
      : "",
    "",
    'Return JSON matching: {"decisionSummary":string,"marketObservations":string[],"risks":string[],"opportunities":string[]}',
    "2-5 concise items per list; each item one sentence grounded in the material above.",
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await provider.complete({ system, prompt });
  const parsed = z
    .object({
      decisionSummary: z.string().default(""),
      marketObservations: z.array(z.string()).default([]),
      risks: z.array(z.string()).default([]),
      opportunities: z.array(z.string()).default([]),
    })
    .parse(parseJsonObject(completion.text));

  return {
    value: reportSectionsSchema.parse(parsed),
    completion,
  };
}

// --- Research planner ---------------------------------------------------------

export async function draftResearchPlan(
  provider: LlmProvider,
  objective: string,
  currency: string,
): Promise<AgentDraft<ResearchPlan>> {
  const system = [
    "You are the research planner inside a commerce research workspace.",
    "Turn a research objective into a short, ordered checklist of evidence to gather.",
    NO_INVENTION,
  ].join("\n");
  const prompt = [
    `Objective: ${objective}`,
    `Currency: ${currency}`,
    "",
    'Return JSON matching: {"steps":[{"title":string,"why":string}]}',
    "3-6 steps; each title is an action the seller can actually perform (e.g. collect five comparable listings).",
  ].join("\n");

  const completion = await provider.complete({ system, prompt });
  const value = researchPlanSchema.parse(parseJsonObject(completion.text));
  return { value, completion };
}

// --- Competitor analyst -------------------------------------------------------

export interface DraftCompetitorsInput {
  readonly currency: string;
  readonly pastedListings: string;
}

export async function draftCompetitorEntries(
  provider: LlmProvider,
  input: DraftCompetitorsInput,
): Promise<AgentDraft<CompetitorDraft[]>> {
  const system = [
    "You are the competitor analyst inside a commerce research workspace.",
    "From the user's pasted listing material, extract every distinct competitor listing.",
    NO_INVENTION,
  ].join("\n");
  const prompt = [
    `Project currency: ${input.currency}. Prices must be plain decimal strings in that currency, or null if unpriced.`,
    "Pasted listings follow, between the markers.",
    "--- BEGIN LISTINGS ---",
    input.pastedListings,
    "--- END LISTINGS ---",
    "",
    'Return JSON matching: {"competitors":[{"product":string,"brand":string,"price":string|null,"marketplace":string,"url":string}]}',
  ].join("\n");

  const completion = await provider.complete({ system, prompt });
  const parsed = competitorDraftListSchema.parse(parseJsonObject(completion.text));
  return { value: parsed.competitors, completion };
}

// --- Economics reviewer ---------------------------------------------------------

export interface ReviewEconomicsInput {
  readonly assumptions: CostAssumptions;
  readonly scenarios: EconomicsScenario[];
  readonly statistics: CompetitorStatistics;
}

export async function reviewEconomics(
  provider: LlmProvider,
  input: ReviewEconomicsInput,
): Promise<AgentDraft<EconomicsReview>> {
  const system = [
    "You are the economics reviewer inside a commerce research workspace.",
    "Sanity-check cost assumptions and calculated scenarios against recorded market prices.",
    "All numbers are exact decimals computed by deterministic code — never recompute them; assess plausibility only.",
    NO_INVENTION,
  ].join("\n");
  const prompt = [
    `Assumptions: ${JSON.stringify(input.assumptions)}`,
    `Calculated scenarios: ${JSON.stringify(input.scenarios)}`,
    `Market price statistics: ${JSON.stringify(input.statistics)}`,
    "",
    'Return JSON matching: {"verdict":"healthy"|"caution"|"risk","summary":string,"findings":[{"severity":"info"|"warning"|"critical","message":string}]}',
    "1-4 findings; flag margins far from the observed price range, missing scenario prices, or fee rates that look unusual for marketplace selling.",
  ].join("\n");

  const completion = await provider.complete({ system, prompt });
  const value = economicsReviewSchema.parse(parseJsonObject(completion.text));
  return { value, completion };
}

// --- Auditor ---------------------------------------------------------------------

export interface AuditReportInput {
  readonly reportMarkdown: string;
  readonly evidenceSummaries: readonly { id: string; title: string; notes: string }[];
}

export async function auditReport(
  provider: LlmProvider,
  input: AuditReportInput,
): Promise<AgentDraft<AuditReport>> {
  const system = [
    "You are the integrity auditor inside a commerce research workspace.",
    "Check whether claims in the drafted decision summary are backed by recorded evidence.",
    NO_INVENTION,
  ].join("\n");
  const prompt = [
    "Evidence on record:",
    ...input.evidenceSummaries.map((source) => `- [${source.id}] ${source.title}${source.notes ? `: ${source.notes}` : ""}`),
    "",
    "Drafted report follows:",
    "--- BEGIN REPORT ---",
    input.reportMarkdown,
    "--- END REPORT ---",
    "",
    'Return JSON matching: {"verdict":"sound"|"gaps-found","summary":string,"findings":[{"status":"supported"|"unverified"|"contradicted","claim":string,"note":string}]}',
    "Assess up to five substantive claims from the decision summary and observations.",
  ].join("\n");

  const completion = await provider.complete({ system, prompt });
  const value = auditReportSchema.parse(parseJsonObject(completion.text));
  return { value, completion };
}
