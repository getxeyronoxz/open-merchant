import { useEffect, useMemo, useState } from "react";

import type {
  AiOrigin,
  AuditReport,
  Competitor,
  CompetitorDraft,
  EconomicsReview,
  EvidenceSource,
  ReportSections,
  ResearchPlan,
} from "@open-merchant/shared";
import { ErrorState, Field, LedgerRow } from "@open-merchant/ui";

import { useProject } from "../../../state/project";
import { nextDraftIndex } from "../draftQueue";
import {
  useAuditReport,
  useCompetitors,
  useDraftCompetitors,
  useDraftEvidence,
  useDraftPlan,
  useDraftSections,
  useEvidence,
  useReviewEconomics,
  useSaveCompetitors,
  useSaveEvidence,
  useSaveReportSections,
} from "../queries";
import type { SectionName } from "../useWorkflowProgress";

type DraftKind = "plan" | "evidence" | "competitors" | "economics" | "sections" | "audit";
type DraftRecord =
  | { id: string; kind: "plan"; origin: AiOrigin; value: ResearchPlan }
  | { id: string; kind: "evidence"; origin: AiOrigin; value: EvidenceSource }
  | { id: string; kind: "competitors"; origin: AiOrigin; value: CompetitorDraft[] }
  | { id: string; kind: "economics"; origin: AiOrigin; value: EconomicsReview }
  | { id: string; kind: "sections"; origin: AiOrigin; value: ReportSections }
  | { id: string; kind: "audit"; origin: AiOrigin; value: AuditReport };

const labels: Record<DraftKind, string> = {
  plan: "Research plan",
  evidence: "Evidence source",
  competitors: "Competitor listings",
  economics: "Economics review",
  sections: "Report sections",
  audit: "Report audit",
};

function nextId(existing: readonly { id: string }[], prefix: "S" | "C"): string {
  const highest = existing.reduce((max, item) => {
    const match = new RegExp(`^${prefix}-(\\d+)$`, "u").exec(item.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

function queueId(): string {
  return `DRAFT-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/** One visible home for the six assistants, with the human gate kept explicit. */
export function DraftDeskScreen({
  root,
  onNavigate,
}: {
  root: string;
  onNavigate: (section: SectionName) => void;
}) {
  const { project } = useProject();
  const currency = project?.manifest.currency ?? "";
  const evidence = useEvidence(root);
  const competitors = useCompetitors(root);
  const saveEvidence = useSaveEvidence(root);
  const saveCompetitors = useSaveCompetitors(root);
  const saveSections = useSaveReportSections(root);
  const plan = useDraftPlan(root);
  const evidenceDraft = useDraftEvidence(root);
  const competitorDraft = useDraftCompetitors(root);
  const economics = useReviewEconomics(root);
  const sectionDraft = useDraftSections(root);
  const audit = useAuditReport(root);

  const [queue, setQueue] = useState<DraftRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [pageText, setPageText] = useState("");
  const [listingText, setListingText] = useState("");
  const [editedEvidence, setEditedEvidence] = useState<EvidenceSource | null>(null);
  const [editedCompetitors, setEditedCompetitors] = useState<CompetitorDraft[]>([]);
  const [editedSections, setEditedSections] = useState<ReportSections | null>(null);
  const active = useMemo(
    () => queue.find((item) => item.id === activeId) ?? queue[0] ?? null,
    [activeId, queue],
  );

  // ArrowLeft / ArrowRight walk the review queue and wrap, so a full session can
  // be triaged without reaching for the mouse. The guard matches the shell's
  // Alt+digit handler: no modifier chords, and never while typing into a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      // Same guard as the shell's Alt+digit handler: never steal keys while the
      // user is typing into the assistant panel's fields.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (queue.length === 0) return;
      event.preventDefault();
      const current = queue.findIndex((item) => item.id === active?.id);
      const step = event.key === "ArrowRight" ? 1 : -1;
      const index = nextDraftIndex(current, queue.length, step);
      const next = index === -1 ? undefined : queue[index];
      if (next) setActiveId(next.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [queue, active?.id]);
  const pending =
    plan.isPending ||
    evidenceDraft.isPending ||
    competitorDraft.isPending ||
    economics.isPending ||
    sectionDraft.isPending ||
    audit.isPending;
  const agentError =
    plan.error ??
    evidenceDraft.error ??
    competitorDraft.error ??
    economics.error ??
    sectionDraft.error ??
    audit.error;

  const enqueue = (record: Omit<DraftRecord, "id">) => {
    const item = { ...record, id: queueId() } as DraftRecord;
    setQueue((current) => [item, ...current]);
    setActiveId(item.id);
  };
  const discard = (id = active?.id) => {
    if (!id) return;
    setQueue((current) => current.filter((item) => item.id !== id));
    setActiveId((current) => (current === id ? null : current));
  };

  useEffect(() => {
    if (active?.kind === "evidence") setEditedEvidence(structuredClone(active.value));
    if (active?.kind === "competitors") setEditedCompetitors(structuredClone(active.value));
    if (active?.kind === "sections") setEditedSections(structuredClone(active.value));
  }, [active?.id, active?.kind]);

  const generate = (kind: DraftKind) => {
    if (kind === "plan") {
      plan.mutate(undefined, {
        onSuccess: ({ plan: value, origin }) => enqueue({ kind, origin, value }),
      });
    } else if (kind === "evidence") {
      if (!sourceUrl.trim() || !pageText.trim()) return;
      evidenceDraft.mutate(
        { url: sourceUrl.trim(), pageText: pageText.trim() },
        {
          onSuccess: ({ draft, origin }) => enqueue({ kind, origin, value: draft }),
        },
      );
    } else if (kind === "competitors") {
      if (!listingText.trim()) return;
      competitorDraft.mutate(listingText.trim(), {
        onSuccess: ({ competitors: value, origin }) => enqueue({ kind, origin, value }),
      });
    } else if (kind === "economics") {
      economics.mutate(undefined, {
        onSuccess: ({ review, origin }) => enqueue({ kind, origin, value: review }),
      });
    } else if (kind === "sections") {
      sectionDraft.mutate(undefined, {
        onSuccess: ({ sections: value, origin }) => enqueue({ kind, origin, value }),
      });
    } else {
      audit.mutate(undefined, {
        onSuccess: ({ audit: value, origin }) => enqueue({ kind, origin, value }),
      });
    }
  };

  const acceptEvidence = () => {
    if (!active || active.kind !== "evidence" || !editedEvidence) return;
    const current = evidence.data?.sources ?? [];
    const accepted = {
      ...editedEvidence,
      id: nextId(current, "S"),
      updatedAt: new Date().toISOString(),
    };
    saveEvidence.mutate(
      { sources: [...current, accepted], origin: active.origin },
      {
        onSuccess: () => {
          discard(active.id);
          onNavigate("Evidence");
        },
      },
    );
  };

  const acceptCompetitors = () => {
    if (!active || active.kind !== "competitors") return;
    const current = competitors.data?.competitors ?? [];
    const existing = new Set(current.map((item) => item.id));
    let number = current.length + 1;
    const accepted = editedCompetitors.map((draft) => {
      let id = `C-${String(number).padStart(3, "0")}`;
      while (existing.has(id)) id = `C-${String(++number).padStart(3, "0")}`;
      existing.add(id);
      number += 1;
      return {
        id,
        ...draft,
        currency,
        sourceId: null,
        notes: "",
        observedAt: new Date().toISOString(),
      } satisfies Competitor;
    });
    saveCompetitors.mutate(
      { competitors: [...current, ...accepted], origin: active.origin },
      {
        onSuccess: () => {
          discard(active.id);
          onNavigate("Competitors");
        },
      },
    );
  };

  const acceptSections = () => {
    if (!active || active.kind !== "sections" || !editedSections) return;
    saveSections.mutate(
      { sections: editedSections, origin: active.origin },
      {
        onSuccess: () => {
          discard(active.id);
          onNavigate("Report");
        },
      },
    );
  };

  const savePending = saveEvidence.isPending || saveCompetitors.isPending || saveSections.isPending;
  const saveError = saveEvidence.error ?? saveCompetitors.error ?? saveSections.error;

  return (
    <section className="screen draft-desk">
      <header className="screen__head">
        <p className="om-eyebrow">Assistant lane</p>
        <h1 className="om-section-title">Draft Desk</h1>
        <p className="screen__sub">
          AI prepares material for review. It cannot calculate margins, browse by itself, or write a
          project artifact until you accept it here.
        </p>
      </header>

      <div className="draft-desk__layout">
        <aside className="om-card om-card--inset draft-desk__tools">
          <p className="om-eyebrow">Run an assistant</p>
          <Field
            label="Evidence URL"
            hint="Only submitted page text is sent to your configured provider."
          >
            <input
              className="om-input"
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://…"
              type="url"
              value={sourceUrl}
            />
          </Field>
          <Field label="Observed page text">
            <textarea
              className="om-textarea"
              onChange={(event) => setPageText(event.target.value)}
              placeholder="Paste the source material…"
              value={pageText}
            />
          </Field>
          <Field label="Pasted competitor listings">
            <textarea
              className="om-textarea"
              onChange={(event) => setListingText(event.target.value)}
              placeholder="Paste listing titles, prices, marketplaces…"
              value={listingText}
            />
          </Field>
          <div className="draft-desk__actions">
            {(Object.keys(labels) as DraftKind[]).map((kind) => (
              <button
                className="om-button om-button--secondary"
                disabled={
                  pending ||
                  (kind === "evidence" && (!sourceUrl.trim() || !pageText.trim())) ||
                  (kind === "competitors" && !listingText.trim())
                }
                key={kind}
                onClick={() => generate(kind)}
                type="button"
              >
                {pending ? "Working…" : labels[kind]}
              </button>
            ))}
          </div>
          {agentError ? (
            <ErrorState
              error={agentError}
              onRetry={() => {
                plan.reset();
                evidenceDraft.reset();
                competitorDraft.reset();
                economics.reset();
                sectionDraft.reset();
                audit.reset();
              }}
            />
          ) : null}
        </aside>

        <div className="draft-desk__queue">
          <div className="draft-desk__queue-head">
            <div>
              <p className="om-eyebrow">Review queue</p>
              <strong>
                {queue.length === 0
                  ? "No drafts waiting"
                  : `${queue.length} draft${queue.length === 1 ? "" : "s"} waiting`}
              </strong>
            </div>
            <span className="draft-desk__queue-actions">
              {queue.length > 1 ? <span className="draft-desk__kbd">← → step</span> : null}
              <span className="om-badge om-badge--brass">Human acceptance required</span>
            </span>
          </div>
          {queue.length > 0 ? (
            <div
              aria-keyshortcuts="ArrowLeft ArrowRight"
              className="draft-desk__tabs"
              role="tablist"
              aria-label="Drafts waiting for review"
            >
              {queue.map((item) => (
                <button
                  aria-selected={item.id === active?.id}
                  className={`draft-desk__tab${item.id === active?.id ? " is-active" : ""}`}
                  key={item.id}
                  onClick={() => setActiveId(item.id)}
                  role="tab"
                  type="button"
                >
                  {labels[item.kind]}
                </button>
              ))}
            </div>
          ) : null}
          {active ? (
            <article className="om-card draft-desk__review">
              <header className="draft-desk__review-head">
                <div>
                  <p className="om-eyebrow">{labels[active.kind]}</p>
                  <h2>Review before anything becomes project data</h2>
                </div>
                <button
                  aria-label="Discard draft"
                  className="om-button om-button--danger"
                  onClick={() => discard()}
                  type="button"
                >
                  Discard
                </button>
              </header>
              <div className="draft-desk__origin" aria-label="AI provenance">
                <LedgerRow label="Agent" value={active.origin.agentId} />
                <LedgerRow
                  label="Provider / model"
                  value={`${active.origin.providerId} · ${active.origin.modelId}`}
                />
                <LedgerRow label="Prompt hash" value={active.origin.promptHash} tone="muted" />
              </div>
              <DraftContent
                draft={active}
                evidence={editedEvidence}
                competitors={editedCompetitors}
                sections={editedSections}
                setEvidence={setEditedEvidence}
                setCompetitors={setEditedCompetitors}
                setSections={setEditedSections}
              />
              {saveError ? <ErrorState error={saveError} /> : null}
              <footer className="draft-desk__review-actions">
                {active.kind === "evidence" ? (
                  <button
                    className="om-button om-button--primary"
                    disabled={savePending || !editedEvidence}
                    onClick={acceptEvidence}
                    type="button"
                  >
                    Accept into Evidence
                  </button>
                ) : null}
                {active.kind === "competitors" ? (
                  <button
                    className="om-button om-button--primary"
                    disabled={savePending}
                    onClick={acceptCompetitors}
                    type="button"
                  >
                    Accept into Market
                  </button>
                ) : null}
                {active.kind === "sections" ? (
                  <button
                    className="om-button om-button--primary"
                    disabled={savePending || !editedSections}
                    onClick={acceptSections}
                    type="button"
                  >
                    Accept into Report
                  </button>
                ) : null}
                {active.kind === "plan" ? (
                  <button
                    className="om-button om-button--secondary"
                    onClick={() => onNavigate("Evidence")}
                    type="button"
                  >
                    Continue research →
                  </button>
                ) : null}
                {active.kind === "economics" ? (
                  <button
                    className="om-button om-button--secondary"
                    onClick={() => onNavigate("Economics")}
                    type="button"
                  >
                    Open Economics →
                  </button>
                ) : null}
                {active.kind === "audit" ? (
                  <button
                    className="om-button om-button--secondary"
                    onClick={() => onNavigate("Artifacts")}
                    type="button"
                  >
                    Inspect evidence →
                  </button>
                ) : null}
              </footer>
            </article>
          ) : (
            <div className="om-card draft-desk__empty">
              <strong>No autonomous inbox.</strong>
              <p>Run an assistant above. Its output stays here until you accept or discard it.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DraftContent({
  draft,
  evidence,
  competitors,
  sections,
  setEvidence,
  setCompetitors,
  setSections,
}: {
  draft: DraftRecord;
  evidence: EvidenceSource | null;
  competitors: CompetitorDraft[];
  sections: ReportSections | null;
  setEvidence: (value: EvidenceSource) => void;
  setCompetitors: (value: CompetitorDraft[]) => void;
  setSections: (value: ReportSections) => void;
}) {
  if (draft.kind === "plan") {
    return (
      <ol className="plan__steps">
        {draft.value.steps.map((step) => (
          <li key={step.title}>
            <strong>{step.title}</strong>
            <span className="om-field__hint">{step.why}</span>
          </li>
        ))}
      </ol>
    );
  }
  if (draft.kind === "economics") {
    return (
      <div className="review">
        <span className="om-badge om-badge--brass">{draft.value.verdict}</span>
        <p>{draft.value.summary}</p>
        {draft.value.findings.map((item) => (
          <LedgerRow key={item.message} label={item.severity} value={item.message} tone="muted" />
        ))}
      </div>
    );
  }
  if (draft.kind === "audit") {
    return (
      <div className="review">
        <span className="om-badge om-badge--brass">{draft.value.verdict}</span>
        <p>{draft.value.summary}</p>
        {draft.value.findings.map((item) => (
          <LedgerRow
            key={item.claim}
            label={item.status}
            value={`${item.claim} — ${item.note}`}
            tone="muted"
          />
        ))}
      </div>
    );
  }
  if (draft.kind === "evidence" && evidence) {
    return (
      <div className="draft-desk__editor">
        <Field label="Source URL">
          <input
            className="om-input"
            onChange={(event) => setEvidence({ ...evidence, url: event.target.value })}
            type="url"
            value={evidence.url}
          />
        </Field>
        <Field label="Title">
          <input
            className="om-input"
            onChange={(event) => setEvidence({ ...evidence, title: event.target.value })}
            value={evidence.title}
          />
        </Field>
        <Field label="Notes">
          <textarea
            className="om-textarea"
            onChange={(event) => setEvidence({ ...evidence, notes: event.target.value })}
            value={evidence.notes}
          />
        </Field>
      </div>
    );
  }
  if (draft.kind === "competitors") {
    return (
      <div className="draft-desk__list">
        {competitors.map((item, index) => (
          <div className="draft-desk__list-row" key={`${item.product}-${index}`}>
            <input
              aria-label={`Draft product ${index + 1}`}
              className="om-input"
              onChange={(event) =>
                setCompetitors(
                  competitors.map((row, i) =>
                    i === index ? { ...row, product: event.target.value } : row,
                  ),
                )
              }
              value={item.product}
            />
            <input
              aria-label={`Draft brand ${index + 1}`}
              className="om-input"
              onChange={(event) =>
                setCompetitors(
                  competitors.map((row, i) =>
                    i === index ? { ...row, brand: event.target.value } : row,
                  ),
                )
              }
              value={item.brand}
            />
            <input
              aria-label={`Draft price ${index + 1}`}
              className="om-input om-money"
              onChange={(event) =>
                setCompetitors(
                  competitors.map((row, i) =>
                    i === index ? { ...row, price: event.target.value || null } : row,
                  ),
                )
              }
              value={item.price ?? ""}
            />
            <input
              aria-label={`Draft marketplace ${index + 1}`}
              className="om-input"
              onChange={(event) =>
                setCompetitors(
                  competitors.map((row, i) =>
                    i === index ? { ...row, marketplace: event.target.value } : row,
                  ),
                )
              }
              value={item.marketplace}
            />
          </div>
        ))}
      </div>
    );
  }
  if (draft.kind === "sections" && sections) {
    return (
      <div className="draft-desk__editor">
        <Field label="Decision summary">
          <textarea
            className="om-textarea"
            onChange={(event) => setSections({ ...sections, decisionSummary: event.target.value })}
            value={sections.decisionSummary}
          />
        </Field>
        <Field label="Market observations">
          <textarea
            className="om-textarea"
            onChange={(event) =>
              setSections({
                ...sections,
                marketObservations: event.target.value.split("\n").filter(Boolean),
              })
            }
            value={sections.marketObservations.join("\n")}
          />
        </Field>
        <Field label="Risks">
          <textarea
            className="om-textarea"
            onChange={(event) =>
              setSections({ ...sections, risks: event.target.value.split("\n").filter(Boolean) })
            }
            value={sections.risks.join("\n")}
          />
        </Field>
        <Field label="Opportunities">
          <textarea
            className="om-textarea"
            onChange={(event) =>
              setSections({
                ...sections,
                opportunities: event.target.value.split("\n").filter(Boolean),
              })
            }
            value={sections.opportunities.join("\n")}
          />
        </Field>
      </div>
    );
  }
  return null;
}
