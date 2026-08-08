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

export interface Observation {
  id: string;
  label: string;
  value: string;
  unit: string | null;
  note: string;
}

export interface EvidenceSource {
  schemaVersion: number;
  id: string;
  url: string;
  title: string;
  notes: string;
  observations: Observation[];
  observedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Competitor {
  schemaVersion: number;
  id: string;
  product: string;
  brand: string;
  price: string | null;
  currency: string;
  marketplace: string;
  url: string;
  sourceId: string | null;
  notes: string;
  observedAt: string;
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
  saveManifest(root: string, manifest: ProjectManifest): Promise<ProjectSnapshot>;
  loadEvidence(root: string): Promise<EvidenceSource[]>;
  saveEvidence(root: string, evidence: EvidenceSource[]): Promise<void>;
  loadCompetitors(root: string): Promise<Competitor[]>;
  saveCompetitors(root: string, competitors: Competitor[]): Promise<void>;
  listRecentProjects(): Promise<RecentProject[]>;
  removeRecentProject(root: string): Promise<void>;
}
