import { useEffect, useState } from "react";

import type { ReportSections } from "../../types";

const fields = [
  ["marketObservations", "Market observations"],
  ["risks", "Risks"],
  ["opportunities", "Opportunities"],
] as const;

function asLines(value: string): string[] {
  return value.split("\n");
}

function joined(values: string[]): string {
  return values.join("\n");
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
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(sections), [sections]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = {
      ...draft,
      marketObservations: draft.marketObservations.map((line) => line.trim()).filter(Boolean),
      risks: draft.risks.map((line) => line.trim()).filter(Boolean),
      opportunities: draft.opportunities.map((line) => line.trim()).filter(Boolean),
    };
    try {
      setError(null);
      await onSaveSections(next);
      setDraft(next);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The report notes could not be saved.");
    }
  };

  const generate = async () => {
    try {
      setError(null);
      setMarkdown(await onGenerate());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Report generation failed.");
    }
  };

  return (
    <section className="rounded-xl border border-stone-800 bg-stone-900 p-6">
      <p className="text-sm font-medium text-emerald-300">Opportunity report</p>
      <h2 className="mt-1 text-2xl font-semibold">Generate an inspectable decision record</h2>
      <p className="mt-3 text-stone-400">Record only your own observations and assumptions. The report is Markdown saved inside this project’s reports folder.</p>
      <form className="mt-6 grid gap-5" onSubmit={(event) => void save(event)}>
        <label className="grid gap-2 text-sm font-medium">Decision summary<textarea className="min-h-24 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" value={draft.decisionSummary} onChange={(event) => { setSaved(false); setDraft({ ...draft, decisionSummary: event.target.value }); }} /></label>
        {fields.map(([key, label]) => <div className="grid gap-2 text-sm font-medium" key={key}><label htmlFor={key}>{label}</label><span className="text-xs font-normal text-stone-400">One item per line.</span><textarea className="min-h-24 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" id={key} value={joined(draft[key])} onChange={(event) => { setSaved(false); setDraft({ ...draft, [key]: asLines(event.target.value) }); }} /></div>)}
        <div className="flex flex-wrap items-center gap-3"><button className="rounded-lg border border-emerald-400 px-4 py-2 font-semibold text-emerald-300" type="submit">Save report notes</button>{saved ? <span className="text-sm text-emerald-300">Saved</span> : null}</div>
      </form>
      <button className="mt-6 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-stone-950" onClick={() => void generate()} type="button">Generate Markdown report</button>
      {error ? <p className="mt-4 text-rose-300" role="alert">{error}</p> : null}
      {markdown ? <pre className="mt-6 max-h-[500px] overflow-auto rounded-lg bg-stone-950 p-4 text-sm text-stone-300">{markdown}</pre> : null}
    </section>
  );
}
