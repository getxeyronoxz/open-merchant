import { useCallback, useEffect, useState } from "react";

import { useDebouncedSave } from "../../hooks/useDebouncedSave";
import type { ProjectManifest, ProjectSnapshot } from "../../types";
import { Button, InsetPanel, PageHeader, Panel, StatusMessage } from "../../components/ui";

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
  const statusLabel = status === "saving" ? "Saving" : status === "saved" ? "Saved" : status === "error" ? "Failed" : null;
  const statusTone = status === "saved" ? "success" : status === "error" ? "error" : status === "saving" ? "working" : "neutral";

  return (
    <Panel>
      <PageHeader
        eyebrow="Research objective"
        status={<StatusMessage tone={statusTone}>{statusLabel}</StatusMessage>}
        title="Keep the decision question clear"
      />
      <label className="mt-6 grid gap-2 text-sm font-semibold text-stone-200">
        Research objective
        <textarea
          className="min-h-48 resize-y px-4 py-3 text-base leading-7"
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
        />
      </label>
      <InsetPanel className="mt-5 flex max-w-sm items-center justify-between gap-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Project currency</p>
          <p className="mt-1 text-sm text-stone-400">Used across competitors and economics.</p>
        </div>
        <input aria-label="Currency" className="w-24 px-3 py-2 text-center font-mono uppercase" value={snapshot.manifest.currency} disabled />
      </InsetPanel>
      {error ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-rose-900/70 bg-rose-950/30 p-3 text-sm text-rose-200" role="alert">
          <span>{error}</span>
          <Button onClick={() => void retry()} size="sm" type="button" variant="danger">Retry</Button>
        </div>
      ) : null}
    </Panel>
  );
}
