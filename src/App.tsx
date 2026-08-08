import { ProjectProvider, useProject } from "./context/ProjectContext";
import { HomeScreen, WorkspaceShell } from "./features/home/HomeScreen";
import { tauriDesktopClient } from "./lib/desktop";
import type { DesktopClient } from "./types";

function AppRouter() {
  const { project } = useProject();
  return project ? <WorkspaceShell /> : <HomeScreen />;
}

export default function App({ client = tauriDesktopClient }: { client?: DesktopClient }) {
  return (
    <ProjectProvider client={client}>
      <AppRouter />
    </ProjectProvider>
  );
}
