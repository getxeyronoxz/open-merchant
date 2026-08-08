import { ProjectProvider, useProject } from "./context/ProjectContext";
import { AppShell } from "./components/AppShell";
import { HomeScreen } from "./features/home/HomeScreen";
import { tauriDesktopClient } from "./lib/desktop";
import type { DesktopClient } from "./types";

function AppRouter() {
  const { project } = useProject();
  return project ? <AppShell /> : <HomeScreen />;
}

export default function App({ client = tauriDesktopClient }: { client?: DesktopClient }) {
  return (
    <ProjectProvider client={client}>
      <AppRouter />
    </ProjectProvider>
  );
}
