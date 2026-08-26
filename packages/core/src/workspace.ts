import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  SCHEMA_VERSION,
  manifestSchema,
  type Manifest,
} from "@open-merchant/shared";

/**
 * Workspace folder lifecycle (walking-skeleton subset — phase 1b completes
 * the artifact layout). A project is an ordinary user-owned directory whose
 * canonical state lives in plain files.
 */

export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

export interface CreateProjectInput {
  readonly parentDirectory: string;
  readonly name: string;
  readonly objective: string;
  readonly currency: string;
}

export const MANIFEST_RELATIVE_PATH = ".openmerchant/manifest.json";

/** Portable lowercase-hyphenated folder name for a project title. */
export function projectFolderName(name: string): string {
  let slug = "";
  let previousWasSeparator = false;
  for (const character of name.trim()) {
    if (/[a-z0-9]/i.test(character)) {
      slug += character.toLowerCase();
      previousWasSeparator = false;
    } else if (!previousWasSeparator && slug.length > 0) {
      slug += "-";
      previousWasSeparator = true;
    }
  }
  return slug.replace(/^-+|-+$/g, "") || "project";
}

export interface CreatedProject {
  readonly root: string;
  readonly manifest: Manifest;
}

export async function createProjectFolder(input: CreateProjectInput): Promise<CreatedProject> {
  const name = input.name.trim();
  const objective = input.objective.trim();
  if (!name) throw new WorkspaceError("Project name is required");
  if (!objective) throw new WorkspaceError("Research objective is required");

  const root = join(input.parentDirectory, projectFolderName(name));

  // Claim the folder atomically (mkdir throws when it already exists), then
  // build the layout; any failure rolls the folder back so a half-created
  // project is never left behind.
  let claimed = false;
  try {
    try {
      await mkdir(root);
      claimed = true;
      await mkdir(join(root, ".openmerchant"));
    } catch (error) {
      if (!claimed && error instanceof Error && "code" in error && error.code === "EEXIST") {
        throw new WorkspaceError(`A project folder already exists at ${root}`);
      }
      throw error;
    }

    const now = new Date().toISOString();
    const manifest: Manifest = manifestSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      projectId: crypto.randomUUID(),
      name,
      objective,
      currency: input.currency.trim(),
      createdAt: now,
      updatedAt: now,
    });

    await writeFile(
      join(root, MANIFEST_RELATIVE_PATH),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    return { root, manifest };
  } catch (error) {
    if (claimed) await rm(root, { recursive: true, force: true });
    throw error;
  }
}
