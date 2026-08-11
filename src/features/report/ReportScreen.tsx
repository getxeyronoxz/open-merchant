import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import { Button, EmptyState, InsetPanel, PageHeader, Panel, StatusMessage } from "../../components/ui";
import type { ReportSections } from "../../types";

const fields = [
  ["marketObservations", "Market observations"],
  ["risks", "Risks"],
  ["opportunities", "Opportunities"],
] as const;

type WorkflowStatus = "idle" | "working" | "success" | "error";

function asLines(value: string): string[] {
  return value.split("\n");
}

function joined(values: string[]): string {
  return values.join("\n");
}

function reportStatus(status: WorkflowStatus) {
  if (status === "working") return "Saving report notes";
  if (status === "success") return "Report notes saved";
  if (status === "error") return "Save failed";
  return null;
}

function generationStatus(status: WorkflowStatus) {
  if (status === "working") return "Generating report";
  if (status === "success") return "Report generated";
  if (status === "error") return "Generation failed";
  return null;
}

export function ReportScreen({
  sections,
  onSaveSections,
  onGenerate,
}: {
  sections: ReportSections;
  onSaveSections: (sections: ReportSections) => Promise<void>;
  onGenerate: () => Promise<string>;
}) {
  const [draft, setDraft] = useState(sections);
  const [markdown, setMarkdown] = useState("");
  const [saveState, setSaveState] = useState<WorkflowStatus>("idle");
  const [generateState, setGenerateState] = useState<WorkflowStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => setDraft(sections), [sections]);

  const updateDraft = (next: ReportSections) => {
    setDraft(next);
    setSaveState("idle");
    setSaveError(null);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = {
      ...draft,
      marketObservations: draft.marketObservations.map((line) => line.trim()).filter(Boolean),
      risks: draft.risks.map((line) => line.trim()).filter(Boolean),
      opportunities: draft.opportunities.map((line) => line.trim()).filter(Boolean),
    };

    setSaveError(null);
    setSaveState("working");
    try {
      await onSaveSections(next);
      setDraft(next);
      setSaveState("success");
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "The report notes could not be saved.");
      setSaveState("error");
    }
  };

  const generate = async () => {
    setGenerationError(null);
    setGenerateState("working");
    try {
      setMarkdown(await onGenerate());
      setGenerateState("success");
    } catch (reason) {
      setGenerationError(reason instanceof Error ? reason.message : "Report generation failed.");
      setGenerateState("error");
    }
  };

  return (
    <Panel>
      <PageHeader
        description="Record only your own observations and assumptions. The report is Markdown saved inside this project’s reports folder."
        eyebrow="Opportunity report"
        title="Generate an inspectable decision record"
      />

      <form className="mt-6 grid gap-5" onSubmit={(event) => void save(event)}>
        <InsetPanel className="grid gap-5">
          <label className="grid gap-2 text-sm font-medium text-stone-200">
            Decision summary
            <textarea
              className="min-h-28"
              value={draft.decisionSummary}
              onChange={(event) => updateDraft({ ...draft, decisionSummary: event.target.value })}
            />
          </label>
          {fields.map(([key, label]) => (
            <div className="grid gap-2 text-sm font-medium text-stone-200" key={key}>
              <label htmlFor={key}>{label}</label>
              <span className="text-xs font-normal text-stone-500">One item per line.</span>
              <textarea
                className="min-h-28"
                id={key}
                value={joined(draft[key])}
                onChange={(event) => updateDraft({ ...draft, [key]: asLines(event.target.value) })}
              />
            </div>
          ))}
        </InsetPanel>

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={saveState === "working"} icon="save" type="submit">
            {saveState === "working" ? "Saving report notes…" : "Save report notes"}
          </Button>
          <StatusMessage
            label="Report notes status"
            tone={saveState === "error" ? "error" : saveState === "success" ? "success" : "working"}
          >
            {reportStatus(saveState)}
          </StatusMessage>
        </div>
        {saveError ? <p className="text-sm text-rose-300" role="alert">{saveError}</p> : null}
      </form>

      <div className="my-7 border-t border-stone-800" />

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={generateState === "working"} icon="document" onClick={() => void generate()} type="button" variant="primary">
          {generateState === "working" ? "Generating report…" : "Generate Markdown report"}
        </Button>
        <StatusMessage
          label="Report generation status"
          tone={generateState === "error" ? "error" : generateState === "success" ? "success" : "working"}
        >
          {generationStatus(generateState)}
        </StatusMessage>
      </div>
      {generationError ? <p className="mt-3 text-sm text-rose-300" role="alert">{generationError}</p> : null}

      <div className="mt-6">
        {markdown ? (
          <article className="max-h-[500px] overflow-auto rounded-[var(--radius-lg)] border border-stone-800 bg-stone-950 p-5 text-sm leading-7 text-stone-300 [&_a]:text-emerald-300 [&_a]:underline [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-stone-50 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-stone-100 [&_li]:ml-5 [&_li]:list-disc [&_p]:my-3 [&_table]:w-full [&_td]:border [&_td]:border-stone-800 [&_td]:p-2 [&_th]:border [&_th]:border-stone-800 [&_th]:p-2 [&_th]:text-left">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </article>
        ) : (
          <EmptyState
            description="Generate the report to preview the Markdown saved by this workspace."
            icon="report"
            title="No generated preview yet"
          />
        )}
      </div>
    </Panel>
  );
}
