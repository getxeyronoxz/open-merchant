import { useEffect, useState } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./lib/query";
import { client } from "./client";
import { HomeScreen } from "./features/home/HomeScreen";
import { WorkspaceShell } from "./features/workspace/WorkspaceShell";
import { ProjectProvider, useProject } from "./state/project";
import { UpdateBanner } from "./features/updates/UpdateBanner";

/** Marks the platform so CSS can adapt to the native title-bar overlay. */
function usePlatformClass() {
  const [platform, setPlatform] = useState<string | null>(null);
  useEffect(() => {
    client
      .appInfo()
      .then((info) => setPlatform(info.platform))
      .catch(() => setPlatform(null));
  }, []);
  useEffect(() => {
    if (platform === null) return;
    document.documentElement.classList.add(`platform-${platform}`);
    return () => document.documentElement.classList.remove(`platform-${platform}`);
  }, [platform]);
}

function Router() {
  const { project } = useProject();
  return project ? <WorkspaceShell /> : <HomeScreen />;
}

export function App() {
  usePlatformClass();
  return (
    <QueryClientProvider client={queryClient}>
      <ProjectProvider>
        <Router />
        <UpdateBanner />
      </ProjectProvider>
    </QueryClientProvider>
  );
}
