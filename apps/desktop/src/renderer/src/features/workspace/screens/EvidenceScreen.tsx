import { useState } from "react";

import type { AiOrigin, EvidenceSource, Observation } from "@open-merchant/shared";
import { EmptyState, ErrorState, Field, LedgerRow } from "@open-merchant/ui";

import { useDraftEvidence, useEvidence, useSaveEvidence } from "../queries";

function nextSourceId(existing: EvidenceSource[]): string {
  const highest = existing.reduce((max, source) => {
    const match = /^S-(\d+)$/u.exec(source.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `S-${String(highest + 1).padStart(3, "0")}`;
}

function emptySource(id: string): EvidenceSource {
  const now = new Date().toISOString();
  return {
    id,
    url: "",
    title: "",
    notes: "",
    observations: [],
    observedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/** Evidence library: every claim in the report should trace to a source here. */
export function EvidenceScreen({ root }: { root: string }) {
  const query = useEvidence(root);
  const save = useSaveEvidence(root);
  const draftAi = useDraftEvidence(root);
  const [draft, setDraft] = useState<EvidenceSource | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiOrigin, setAiOrigin] = useState<AiOrigin | null>(null);

  // All hooks above; conditional rendering below.
  if (query.isPending) {
    return (
      <p className="om-loading">
        <span className="om-spinner" /> Loading evidence…
      </p>
    );
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const sources = query.data.sources;

  const upsert = (next: EvidenceSource) => {
    const updated = sources.some((source) => source.id === next.id)
      ? sources.map((source) => (source.id === next.id ? next : source))
      : [...sources, next];
    save.mutate(
      { sources: updated, origin: aiOrigin ?? undefined },
      {
        onSuccess: () => {
          setDraft(null);
          setAiOrigin(null);
          setAiPanelOpen(false);
        },
      },
    );
  };

  const remove = (id: string) => {
    save.mutate({ sources: sources.filter((source) => source.id !== id) });
  };

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="om-eyebrow">Evidence</p>
        <h1 className="om-section-title">Keep the source behind every claim</h1>
        <p className="om-section-sub">
          Paste what you observed — listings, forum threads, supplier pages. The report links back
          here.
        </p>
      </header>

      {draft === null && !aiPanelOpen ? (
        <div className="screen__actions">
          <button
            className="om-button om-button--primary"
            onClick={() => setDraft(emptySource(nextSourceId(sources)))}
            type="button"
          >
            Add source
          </button>
          <button
            className="om-button om-button--secondary"
            onClick={() => setAiPanelOpen(true)}
            type="button"
          >
            Draft with AI
          </button>
        </div>
      ) : null}

      {aiPanelOpen && draft === null ? (
        <form
          className="om-card screen__form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            draftAi.mutate(
              { url: String(data.get("url") ?? ""), pageText: String(data.get("pageText") ?? "") },
              {
                onSuccess: (result) => {
                  setDraft(result.draft);
                  setAiOrigin(result.origin);
                  setAiPanelOpen(false);
                },
              },
            );
          }}
        >
          <p className="om-eyebrow">Evidence assistant</p>
          <Field hint="The assistant reads only what you paste here." label="Source URL">
            <input className="om-input" name="url" placeholder="https://…" required type="url" />
          </Field>
          <Field label="Paste the listing or page content">
            <textarea
              className="om-textarea"
              name="pageText"
              placeholder="Copy the listing text, forum post, or supplier page in here."
              required
            />
          </Field>
          <div className="screen__actions">
            <button
              className="om-button om-button--secondary"
              onClick={() => setAiPanelOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button className="om-button om-button--primary" disabled={draftAi.isPending} type="submit">
              {draftAi.isPending ? "Drafting…" : "Produce draft"}
            </button>
          </div>
          {draftAi.isError ? <ErrorState error={draftAi.error} onRetry={() => draftAi.reset()} /> : null}
        </form>
      ) : null}

      {draft !== null ? (
        <SourceForm
          initial={draft}
          onCancel={() => {
            setDraft(null);
            setAiOrigin(null);
          }}
          onSave={upsert}
          saving={save.isPending}
        />
      ) : null}

      {save.isError ? <ErrorState error={save.error} onRetry={() => save.mutate({ sources })} /> : null}

      {sources.length === 0 && draft === null ? (
        <EmptyState title="No sources yet">
          <span>Add the listing, search result, or report behind your research.</span>
        </EmptyState>
      ) : (
        <div className="om-ledger">
          {sources.map((source) => (
            <article className="om-card" key={source.id}>
              <div className="evidence__row">
                <div>
                  <h2 className="evidence__title">{source.title}</h2>
                  <a
                    className="evidence__link"
                    href={source.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {source.url}
                  </a>
                  {source.notes ? <p className="evidence__notes">{source.notes}</p> : null}
                </div>
                <div className="evidence__actions">
                  <span className="om-badge om-badge--brass">{source.id}</span>
                  <button
                    className="om-button om-button--ghost"
                    onClick={() => setDraft(source)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="om-button om-button--danger"
                    onClick={() => remove(source.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {source.observations.length > 0 ? (
                <LedgerRow
                  label="Observed values"
                  value={String(source.observations.length)}
                  tone="muted"
                />
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SourceForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: EvidenceSource;
  onSave: (next: EvidenceSource) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<EvidenceSource>(initial);

  const addObservation = () => {
    setDraft({
      ...draft,
      observations: [
        ...draft.observations,
        { id: `O-${draft.observations.length + 1}`, label: "", value: "", unit: null, note: "" },
      ],
    });
  };

  const setObservation = (index: number, updated: Observation) => {
    setDraft({
      ...draft,
      observations: draft.observations.map((item, i) => (i === index ? updated : item)),
    });
  };

  return (
    <form
      className="om-card screen__form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...draft, updatedAt: new Date().toISOString() });
      }}
    >
      <Field label="Source URL">
        <input
          className="om-input"
          onChange={(event) => setDraft({ ...draft, url: event.target.value })}
          placeholder="https://…"
          required
          type="url"
          value={draft.url}
        />
      </Field>
      <Field label="Title">
        <input
          className="om-input"
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          placeholder="Marketplace category page"
          required
          value={draft.title}
        />
      </Field>
      <Field label="Notes">
        <textarea
          className="om-textarea"
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          placeholder="What did you observe here?"
          value={draft.notes}
        />
      </Field>

      <fieldset className="evidence__observations">
        <legend>Observed values</legend>
        {draft.observations.map((observation, index) => (
          <div className="evidence__observation" key={`${observation.id}-${index}`}>
            <input
              aria-label="Label"
              className="om-input"
              onChange={(event) => setObservation(index, { ...observation, label: event.target.value })}
              placeholder="Label"
              value={observation.label}
            />
            <input
              aria-label="Value"
              className="om-input om-money"
              onChange={(event) => setObservation(index, { ...observation, value: event.target.value })}
              placeholder="Value"
              value={observation.value}
            />
            <input
              aria-label="Unit"
              className="om-input"
              onChange={(event) =>
                setObservation(index, { ...observation, unit: event.target.value || null })
              }
              placeholder="Unit"
              value={observation.unit ?? ""}
            />
            <button
              aria-label={`Remove observation ${index + 1}`}
              className="om-button om-button--ghost"
              onClick={() =>
                setDraft({
                  ...draft,
                  observations: draft.observations.filter((_, i) => i !== index),
                })
              }
              type="button"
            >
              ✕
            </button>
          </div>
        ))}
        <button className="om-button om-button--secondary" onClick={addObservation} type="button">
          Add observation
        </button>
      </fieldset>

      <div className="screen__form-foot">
        <span className="om-data">{draft.id}</span>
        <button className="om-button om-button--primary" disabled={saving} type="submit">
          {saving ? "Saving…" : "Save source"}
        </button>
        <button className="om-button om-button--secondary" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}
