export interface ProjectManifest {
  schemaVersion: number;
  projectId: string;
  name: string;
  objective: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSnapshot {
  root: string;
  manifest: ProjectManifest;
}

export interface RecentProject {
  name: string;
  path: string;
  lastOpenedAt: string;
}

export interface CreateProjectInput {
  parentDirectory: string;
  name: string;
  objective: string;
  currency: string;
}

export interface DesktopClient {
  chooseDirectory(title: string): Promise<string | null>;
  createProject(input: CreateProjectInput): Promise<ProjectSnapshot>;
  openProject(root: string): Promise<ProjectSnapshot>;
  listRecentProjects(): Promise<RecentProject[]>;
  removeRecentProject(root: string): Promise<void>;
}
