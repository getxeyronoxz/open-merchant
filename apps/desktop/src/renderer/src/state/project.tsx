import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { ProjectSnapshot } from "@open-merchant/shared";

interface ProjectState {
  readonly project: ProjectSnapshot | null;
  openProject(snapshot: ProjectSnapshot): void;
  updateManifest(snapshot: ProjectSnapshot): void;
  closeProject(): void;
}

const ProjectContext = createContext<ProjectState | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const value = useMemo<ProjectState>(
    () => ({
      project,
      openProject: (snapshot) => setProject(snapshot),
      updateManifest: (snapshot) => setProject(snapshot),
      closeProject: () => setProject(null),
    }),
    [project],
  );
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectState {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("useProject must be used inside ProjectProvider");
  return context;
}
