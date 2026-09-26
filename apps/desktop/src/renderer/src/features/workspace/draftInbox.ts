import type {
  AuditReport,
  CompetitorDraft,
  EconomicsReview,
  EvidenceSource,
  GenerationOrigin,
  ReportSections,
  ResearchPlan,
} from "@open-merchant/shared";

/**
 * The review queue behind the Draft Desk.
 *
 * Pure functions, deliberately free of React and DOM types so they typecheck
 * under both the web and node tsconfigs and can be unit-tested without mounting
 * anything — matching how `draftQueue` is verified. The hook that wraps them
 * lives in `DraftInboxProvider.tsx`.
 */

type DraftBase = {
  readonly id: string;
  readonly origin: GenerationOrigin;
  readonly createdAt: string;
};

/**
 * A draft is something a human has not accepted yet. Its origin may be a model,
 * a local connector, or the person typing — so it is a general GenerationOrigin,
 * not an AI-only shape. Which of the three it is stays visible on the desk.
 *
 * This is deliberately narrower than `draftRecordSchema`: it is every kind the
 * Draft Desk can actually show. A `currency` preview belongs on the economics
 * screen, not here, and a connector is not allowed to produce one — the
 * `connectors/fetch` response is typed to the same six kinds.
 */
export type DraftRecord =
  | (DraftBase & { kind: "plan"; value: ResearchPlan })
  | (DraftBase & { kind: "evidence"; value: EvidenceSource })
  | (DraftBase & { kind: "competitors"; value: CompetitorDraft[] })
  | (DraftBase & { kind: "economics"; value: EconomicsReview })
  | (DraftBase & { kind: "sections"; value: ReportSections })
  | (DraftBase & { kind: "audit"; value: AuditReport });

/** `Omit` over a union collapses it; this keeps every variant's own fields. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A draft this app is creating now: no id and no timestamp yet. */
export type NewDraft = DistributiveOmit<DraftRecord, "id" | "createdAt">;

/**
 * Puts a whole fetch at the head of the queue, keeping the order it arrived in
 * so a connector's evidence draft is read before its competitor draft.
 *
 * A draft id already in the queue is skipped. Enqueuing is the one place where
 * a duplicate could quietly become two identical rows to accept, and a second
 * click on Fetch must never be able to do that.
 */
export function enqueueDrafts(
  existing: readonly DraftRecord[],
  incoming: readonly DraftRecord[],
): DraftRecord[] {
  const seen = new Set(existing.map((draft) => draft.id));
  const accepted: DraftRecord[] = [];
  for (const draft of incoming) {
    if (seen.has(draft.id)) continue;
    seen.add(draft.id);
    accepted.push(draft);
  }
  return [...accepted, ...existing];
}

/** Removes one draft by id. An id that is not queued leaves the queue as it was. */
export function removeDraft(existing: readonly DraftRecord[], id: string): DraftRecord[] {
  return existing.filter((draft) => draft.id !== id);
}
