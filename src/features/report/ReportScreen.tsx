import { useState } from "react";

export function ReportScreen({ onGenerate }: { onGenerate: () => Promise<string> }) {
  const [markdown, setMarkdown] = useState(""); const [error, setError] = useState<string | null>(null);
  return <section className="rounded-xl border border-stone-800 bg-stone-900 p-6"><p className="text-sm font-medium text-emerald-300">Opportunity report</p><h2 className="mt-1 text-2xl font-semibold">Generate an inspectable decision record</h2><p className="mt-3 text-stone-400">The report is Markdown saved inside this project’s reports folder.</p><button className="mt-5 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-stone-950" onClick={() => void onGenerate().then(setMarkdown).catch((reason) => setError(reason instanceof Error ? reason.message : "Report generation failed."))} type="button">Generate Markdown report</button>{error ? <p className="mt-4 text-rose-300">{error}</p> : null}{markdown ? <pre className="mt-6 max-h-[500px] overflow-auto rounded-lg bg-stone-950 p-4 text-sm text-stone-300">{markdown}</pre> : null}</section>;
}
