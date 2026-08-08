import { useCallback, useEffect, useState } from "react";

import { useDebouncedSave } from "../../hooks/useDebouncedSave";
import type { ProjectManifest, ProjectSnapshot } from "../../types";

export function ObjectiveScreen({
  snapshot,
  onSave,
}: {
  snapshot: ProjectSnapshot;
  onSave: (manifest: ProjectManifest) => Promise<unknown>;
}) {
  const [objective, setObjective] = useState(snapshot.manifest.objective);
  useEffect(() => setObjective(snapshot.manifest.objective), [snapshot.manifest.objective]);
  const save = useCallback(
    (nextObjective: string) => onSave({ ...snapshot.manifest, objective: nextObjective }),
    [onSave, snapshot.manifest],
  );
  const { status, error, retry } = useDebouncedSave(objective, save, 500);

  return (
    <section className="rounded-xl border border-stone-800 bg-stone-900 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-emerald-300">Research objective</p>
          <h2 className="mt-1 text-2xl font-semibold">Keep the decision question clear</h2>
        </div>
        <p aria-live="polite" className="text-sm text-stone-400">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Save failed" : ""}
        </p>
      </div>
      <label className="mt-6 grid gap-2 text-sm font-medium">
        Research objective
        <textarea
          className="min-h-36 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-base leading-7"
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
        />
      </label>
      <label className="mt-5 grid max-w-36 gap-2 text-sm font-medium">
        Currency
        <input className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 uppercase" value={snapshot.manifest.currency} disabled />
      </label>
      {error ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-rose-900 bg-rose-950/50 p-3 text-sm text-rose-200">
          <span>{error}</span>
          <button className="underline" onClick={() => void retry()} type="button">Retry</button>
        </div>
      ) : null}
    </section>
  );
}
