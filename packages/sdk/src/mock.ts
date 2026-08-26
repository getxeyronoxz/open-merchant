import type { CreateProjectInput } from "@open-merchant/shared";

import { AppError } from "@open-merchant/shared";
import type { DesktopClient } from "./client";

export interface MockProject {
  root: string;
  manifest: {
    schemaVersion: 2;
    projectId: string;
    name: string;
    objective: string;
    currency: string;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * In-memory DesktopClient for Vitest and renderer development outside
 * Electron. Mirrors the real shell's semantics: unknown roots are rejected
 * as not-a-project, duplicate names within a parent already exist, and every
 * rejection carries a coded AppError.
 */
export function createMockDesktopClient(seed: Partial<{ projects: MockProject[]; version: string }> = {}): DesktopClient & {
  projects: MockProject[];
} {
  const projects = seed.projects ?? [];
  const now = () => new Date().toISOString();

  const client: DesktopClient & { projects: MockProject[] } = {
    projects,
    appInfo: async () => ({
      appName: "Open Merchant",
      appVersion: seed.version ?? "0.0.0-mock",
      platform: "mock",
    }),
    createProject: async (input: CreateProjectInput) => {
      if (!input.parentDirectory.trim()) {
        throw new AppError({ code: "invalid-input", message: "Choose a parent directory first." });
      }
      if (projects.some((project) => project.manifest.name === input.name)) {
        throw new AppError({ code: "already-exists", message: `A project named ${input.name} already exists.` });
      }
      const project: MockProject = {
        root: `${input.parentDirectory}/${input.name}`,
        manifest: {
          schemaVersion: 2,
          projectId: crypto.randomUUID(),
          name: input.name,
          objective: input.objective,
          currency: input.currency,
          createdAt: now(),
          updatedAt: now(),
        },
      };
      projects.push(project);
      return { snapshot: project };
    },
    openProject: async ({ root }) => {
      const found = projects.find((project) => project.root === root);
      if (!found) {
        throw new AppError({ code: "not-a-project", message: "That folder is not an Open Merchant project." });
      }
      return { snapshot: found };
    },
    listRecents: async () => ({
      projects: projects.map((project) => ({
        name: project.manifest.name,
        path: project.root,
        lastOpenedAt: project.manifest.updatedAt,
      })),
    }),
  };
  return client;
}
