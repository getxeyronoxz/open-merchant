import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./lib/query";
import { HomeScreen } from "./features/home/HomeScreen";
import { WorkspaceShell } from "./features/workspace/WorkspaceShell";
import { ProjectProvider, useProject } from "./state/project";

function Router() {
  const { project } = useProject();
  return project ? <WorkspaceShell /> : <HomeScreen />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProjectProvider>
        <Router />
      </ProjectProvider>
    </QueryClientProvider>
  );
}
