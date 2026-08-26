import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { GenerationOrigin, ReportSections } from "@open-merchant/shared";
import { ErrorState, Field } from "@open-merchant/ui";

import {
  useDraftSections,
  useGenerateReport,
  useGeneratedReport,
  useReportSections,
  useSaveReportSections,
} from "../queries";

/**
 * The opportunity report: user-owned narrative sections plus the
 * deterministic markdown generated from every saved artifact. Generated
 * reports read on paper — documents are paper.
 */
export function ReportScreen({ root }: { root: string }) {
  const sectionsQuery = useReportSections(root);
  const generatedQuery = useGeneratedReport(root);
  const generate = useGenerateReport(root);
  const draftAi = useDraftSections(root);
  const [aiDrafted, setAiDrafted] = useState(false);

  if (sectionsQuery.isPending) {
    return (
      <p className="om-loading">
        <span className="om-spinner" /> Loading report sections…
      </p>
    );
  }
  if (sectionsQuery.isError) {
    return <ErrorState error={sectionsQuery.error} onRetry={() => sectionsQuery.refetch()} />;
  }

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="om-eyebrow">Report</p>
        <h1 className="om-section-title">Write down the decision</h1>
        <p className="om-section-sub">
          Draft your sections yourself or ask the report writer for a first pass — either way,
          nothing is saved until you approve it.
        </p>
      </header>

      <div className="screen__columns">
        <div className="screen__stack">
          <div className="screen__actions">
            <button
              className="om-button om-button--secondary"
              disabled={draftAi.isPending}
              onClick={() =>
                draftAi.mutate(undefined, {
                  onSuccess: () => setAiDrafted(true),
                })
              }
              type="button"
            >
              {draftAi.isPending ? "Drafting…" : "Draft sections with AI"}
            </button>
            {aiDrafted && !draftAi.isError ? (
              <span className="om-badge om-badge--brass">AI draft — review before saving</span>
            ) : null}
          </div>
          {draftAi.isError ? (
            <ErrorState error={draftAi.error} onRetry={() => draftAi.reset()} />
          ) : null}

          <SectionsEditor
            aiOrigin={
              aiDrafted && draftAi.data ? draftAi.data.origin : undefined
            }
            initial={sectionsQuery.data.sections}
            onDraftApplied={() => setAiDrafted(false)}
            proposed={draftAi.data?.sections}
            root={root}
          />
        </div>

        <aside className="screen__report-side">
          <button
            className="om-button om-button--primary"
            disabled={generate.isPending}
            onClick={() => generate.mutate()}
            type="button"
          >
            {generate.isPending ? "Generating…" : "Generate report"}
          </button>
          {generate.isError ? (
            <ErrorState error={generate.error} onRetry={() => generate.mutate()} />
          ) : null}

          {generatedQuery.isPending ? (
            <p className="om-loading">
              <span className="om-spinner" /> Checking for a saved report…
            </p>
          ) : null}
          {generatedQuery.isError ? (
            <ErrorState error={generatedQuery.error} onRetry={() => generatedQuery.refetch()} />
          ) : null}

          {generatedQuery.data?.markdown ? (
            <div className="om-paper report-preview" aria-label="Generated opportunity report">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {generatedQuery.data.markdown}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="om-empty">
              <span className="om-empty__title">No generated report yet</span>
              <span>Generating writes economics/scenarios.json and reports/opportunity-report.md.</span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function SectionsEditor({
  root,
  initial,
  proposed,
  aiOrigin,
  onDraftApplied,
}: {
  root: string;
  initial: ReportSections;
  proposed?: ReportSections;
  aiOrigin?: GenerationOrigin;
  onDraftApplied: () => void;
}) {
  const save = useSaveReportSections(root);
  const [draft, setDraft] = useState<ReportSections>(initial);

  // Adopt an accepted AI proposal once when it arrives.
  useEffect(() => {
    if (proposed) setDraft(proposed);
  }, [proposed]);

  const listField = (label: string, key: "marketObservations" | "risks" | "opportunities") => (
    <Field hint="One entry per line." label={label}>
      <textarea
        className="om-textarea"
        onChange={(event) => {
          onDraftApplied();
          setDraft({
            ...draft,
            [key]: event.target.value.split("\n").filter((line) => line.trim().length > 0),
          });
        }}
        value={draft[key].join("\n")}
      />
    </Field>
  );

  return (
    <form
      className="om-card screen__form"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(
          { sections: draft, origin: aiOrigin },
          { onSuccess: onDraftApplied },
        );
      }}
    >
      <Field label="Decision summary">
        <textarea
          className="om-textarea"
          onChange={(event) => {
            onDraftApplied();
            setDraft({ ...draft, decisionSummary: event.target.value });
          }}
          placeholder="What did you decide, and why?"
          value={draft.decisionSummary}
        />
      </Field>
      {listField("Market observations", "marketObservations")}
      {listField("Risks", "risks")}
      {listField("Opportunities", "opportunities")}

      <div className="screen__actions">
        <button className="om-button om-button--primary" disabled={save.isPending} type="submit">
          {save.isPending ? "Saving…" : "Save sections"}
        </button>
      </div>
      {save.isSuccess && !aiOrigin ? (
        <p className="om-badge om-badge--accent" role="status">
          Saved
        </p>
      ) : null}
      {save.isSuccess && aiOrigin ? (
        <p className="om-badge om-badge--accent" role="status">
          Saved — provenance recorded for the AI draft
        </p>
      ) : null}
      {save.isError ? (
        <ErrorState error={save.error} onRetry={() => save.mutate({ sections: draft })} />
      ) : null}
    </form>
  );
}
