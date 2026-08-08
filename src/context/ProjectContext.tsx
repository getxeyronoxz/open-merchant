import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { DesktopClient, ProjectSnapshot } from "../types";

interface ProjectContextValue {
  client: DesktopClient;
  project: ProjectSnapshot | null;
  setProject(project: ProjectSnapshot): void;
  closeProject(): void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  client,
  children,
}: {
  client: DesktopClient;
  children: ReactNode;
}) {
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const value = useMemo(
    () => ({
      client,
      project,
      setProject,
      closeProject: () => setProject(null),
    }),
    [client, project],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used inside ProjectProvider");
  }
  return context;
}
