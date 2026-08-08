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
  saveManifest: (root, manifest) =>
    invoke<ProjectSnapshot>("save_manifest", { root, manifest }),
  loadEvidence: (root) => invoke("load_evidence", { root }),
  saveEvidence: (root, evidence) => invoke("save_evidence", { root, evidence }),
  loadCompetitors: (root) => invoke("load_competitors", { root }),
  saveCompetitors: (root, competitors) => invoke("save_competitors", { root, competitors }),
  listRecentProjects: () => invoke<RecentProject[]>("list_recent_projects"),
  removeRecentProject: (root: string) =>
    invoke<void>("remove_recent_project", { root }),
};
