import { z } from "zod";

/**
 * Structured outputs for the assistant agents. Every agent returns one of
 * these validated shapes; nothing an agent says reaches storage without the
 * human accepting it through a save channel first.
 */

export const researchPlanSchema = z.object({
  steps: z.array(
    z.object({
      title: z.string().min(1),
      why: z.string(),
    }),
  ),
});

export type ResearchPlan = z.infer<typeof researchPlanSchema>;

export const competitorDraftSchema = z.object({
  product: z.string().min(1),
  brand: z.string().default(""),
  price: z.string().regex(/^-?\d+(\.\d{1,2})?$/u).nullable(),
  marketplace: z.string().default(""),
  url: z.string().default(""),
});

export const competitorDraftListSchema = z.object({
  competitors: z.array(competitorDraftSchema),
});

export type CompetitorDraft = z.infer<typeof competitorDraftSchema>;

export const economicsReviewSchema = z.object({
  verdict: z.enum(["healthy", "caution", "risk"]),
  summary: z.string(),
  findings: z.array(
    z.object({
      severity: z.enum(["info", "warning", "critical"]),
      message: z.string(),
    }),
  ),
});

export type EconomicsReview = z.infer<typeof economicsReviewSchema>;

export const auditReportSchema = z.object({
  verdict: z.enum(["sound", "gaps-found"]),
  summary: z.string(),
  findings: z.array(
    z.object({
      status: z.enum(["supported", "unverified", "contradicted"]),
      claim: z.string(),
      note: z.string(),
    }),
  ),
});

/** Providers behind the BYO-key / local-endpoint registry. */
export const providerIdSchema = z.enum(["anthropic", "openai", "gemini", "local-openai"]);
export type ProviderId = z.infer<typeof providerIdSchema>;

export type AuditReport = z.infer<typeof auditReportSchema>;
