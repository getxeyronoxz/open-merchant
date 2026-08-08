import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import type {
  CreateProjectInput,
  DesktopClient,
  ProjectSnapshot,
  RecentProject,
} from "../types";

async function chooseDirectory(title: string): Promise<string | null> {
  const result = await open({ directory: true, multiple: false, title });
  return typeof result === "string" ? result : null;
}

export const tauriDesktopClient: DesktopClient = {
  chooseDirectory,
  createProject: (input: CreateProjectInput) =>
    invoke<ProjectSnapshot>("create_project", { request: input }),
  openProject: (root: string) => invoke<ProjectSnapshot>("open_project", { root }),
  listRecentProjects: () => invoke<RecentProject[]>("list_recent_projects"),
  removeRecentProject: (root: string) =>
    invoke<void>("remove_recent_project", { root }),
};
