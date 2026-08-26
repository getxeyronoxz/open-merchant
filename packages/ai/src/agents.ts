import { z } from "zod";

import type {
  Competitor,
  CompetitorStatistics,
  CostAssumptions,
  EconomicsScenario,
  EvidenceSource,
  ReportSections,
} from "@open-merchant/shared";
import { evidenceSourceSchema, reportSectionsSchema } from "@open-merchant/shared";

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
