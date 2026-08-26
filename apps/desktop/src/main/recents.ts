import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { recentProjectSchema, type RecentProject } from "@open-merchant/shared";
import { z } from "zod";

/**
 * Recent-projects list stored in app-private user data — never inside a
 * project folder. Saves are replace-on-success: a temporary file is written
 * first and renamed over the target (atomic on POSIX; on Windows Node maps
 * rename to MoveFileExW with REPLACE_EXISTING), so an interrupted save can
 * never corrupt the previous list.
 */

const recentsFileSchema = z.object({ projects: z.array(recentProjectSchema) });

export class RecentsStore {
  private readonly filePath: string;

  constructor(userDataDirectory: string) {
    this.filePath = join(userDataDirectory, "recent-projects.json");
  }

  async list(): Promise<RecentProject[]> {
    try {
      const parsed = recentsFileSchema.parse(JSON.parse(await readFile(this.filePath, "utf8")));
      return [...parsed.projects].sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
    } catch {
      return [];
    }
  }

  async upsert(name: string, path: string): Promise<void> {
    const existing = await this.list();
    const entry: RecentProject = { name, path, lastOpenedAt: new Date().toISOString() };
    await this.write([entry, ...existing.filter((project) => project.path !== path)]);
  }

  async remove(path: string): Promise<void> {
    const existing = await this.list();
    await this.write(existing.filter((project) => project.path !== path));
  }

  private async write(projects: RecentProject[]): Promise<void> {
    const contents = `${JSON.stringify(recentsFileSchema.parse({ projects }), null, 2)}\n`;
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporary = join(dirname(this.filePath), `.${process.pid}.recent-projects.tmp`);
    try {
      await writeFile(temporary, contents, "utf8");
      await rename(temporary, this.filePath);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }
}
