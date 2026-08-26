import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { ErrorState, Field } from "@open-merchant/ui";

import { client } from "../../../client";
import { useProject } from "../../../state/project";

/** Research objective: the project's identity. Currency is fixed at creation. */
export function ObjectiveScreen({ root }: { root: string }) {
  const { project, updateManifest } = useProject();
  const [name, setName] = useState(project?.manifest.name ?? "");
  const [objective, setObjective] = useState(project?.manifest.objective ?? "");

  // Resync the draft when a different project is opened; name/objective are
  // read once per project rather than tracking live manifest edits.
  const projectId = project?.manifest.projectId;
  useEffect(() => {
    if (project) {
      setName(project.manifest.name);
      setObjective(project.manifest.objective);
    }
  }, [projectId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("No open project");
      const result = await client.saveManifest(root, {
        ...project.manifest,
        name,
        objective,
      });
      updateManifest(result.snapshot);
    },
  });

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="om-eyebrow">Objective</p>
        <h1 className="om-section-title">What decision is this project for?</h1>
        <p className="om-section-sub">
          The objective keeps every note, price, and calculation pointed at one commercial
          question.
        </p>
      </header>

      <form
        className="om-card screen__form"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Project name">
          <input
            className="om-input"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </Field>
        <Field label="Research objective">
          <textarea
            className="om-textarea"
            onChange={(event) => setObjective(event.target.value)}
            placeholder="Should we enter the Indian enthusiast keyboard market this quarter?"
            required
            value={objective}
          />
        </Field>
        <div className="screen__form-foot">
          <span className="om-badge">Currency: {project?.manifest.currency ?? "—"}</span>
          <button className="om-button om-button--primary" disabled={save.isPending} type="submit">
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
        {save.isSuccess ? (
          <p className="om-badge om-badge--accent" role="status">
            Saved
          </p>
        ) : null}
        {save.isError ? <ErrorState error={save.error} onRetry={() => save.mutate()} /> : null}
      </form>
    </section>
  );
}
