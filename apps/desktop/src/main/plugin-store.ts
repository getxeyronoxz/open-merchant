import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { pluginManifestSchema, type InstalledPlugin, type PluginManifest } from "@open-merchant/shared";

export interface BrokenPlugin {
  readonly directoryName: string;
  readonly reason: string;
}

export interface PluginCatalog {
  readonly plugins: InstalledPlugin[];
  readonly broken: BrokenPlugin[];
}

interface PersistedState {
  plugins: Record<string, { enabled: boolean; enabledAt: string | null }>;
}

const EMPTY_STATE: PersistedState = { plugins: {} };

/**
 * Discovers capability-declared plugins in app data. A plugin is data, never
 * code: nothing here imports a plugin, and only a `connector` manifest names an
 * external command that the connector client spawns under its own controls.
 */
export class PluginStore {
  constructor(private readonly userDataDirectory: string) {}

  private get directory(): string {
    return join(this.userDataDirectory, "plugins");
  }

  private get statePath(): string {
    return join(this.userDataDirectory, "plugin-state.json");
  }

  async list(): Promise<PluginCatalog> {
    const state = await this.readState();
    const broken: BrokenPlugin[] = [];
    const candidates: { directoryName: string; manifest: PluginManifest }[] = [];

    for (const directoryName of await this.pluginDirectories()) {
      let raw: string;
      try {
        raw = await readFile(join(this.directory, directoryName, "manifest.json"), "utf8");
      } catch {
        broken.push({ directoryName, reason: "manifest.json is missing or unreadable." });
        continue;
      }

      let candidate: unknown;
      try {
        candidate = JSON.parse(raw);
      } catch {
        broken.push({ directoryName, reason: "manifest.json is not valid JSON." });
        continue;
      }

      const parsed = pluginManifestSchema.safeParse(candidate);
      if (!parsed.success) {
        broken.push({ directoryName, reason: describeIssues(parsed.error.issues) });
        continue;
      }
      candidates.push({ directoryName, manifest: parsed.data });
    }

    // A duplicated id refuses every claimant. Letting the first directory win
    // would make the other plugin vanish with no trace, and the seller would
    // never learn two things were fighting over one id.
    const claims = new Map<string, string[]>();
    for (const candidate of candidates) {
      const owners = claims.get(candidate.manifest.id) ?? [];
      owners.push(candidate.directoryName);
      claims.set(candidate.manifest.id, owners);
    }

    const plugins: InstalledPlugin[] = [];
    for (const { directoryName, manifest } of candidates) {
      const owners = claims.get(manifest.id) ?? [];
      if (owners.length > 1) {
        broken.push({
          directoryName,
          reason: `Duplicate plugin id "${manifest.id}" claimed by ${owners
            .map((owner) => `"${owner}"`)
            .join(", ")}. Rename or remove one.`,
        });
        continue;
      }
      if (manifest.id !== directoryName) {
        broken.push({
          directoryName,
          reason: `Directory name "${directoryName}" does not match manifest id "${manifest.id}".`,
        });
        continue;
      }

      const entry = state.plugins[manifest.id];
      plugins.push({
        manifest,
        directory: join(this.directory, directoryName),
        enabled: entry?.enabled ?? false,
        enabledAt: entry?.enabledAt ?? null,
      });
    }

    return { plugins, broken };
  }

  async setEnabled(pluginId: string, enabled: boolean): Promise<InstalledPlugin> {
    const catalog = await this.list();
    const plugin = catalog.plugins.find((entry) => entry.manifest.id === pluginId);
    if (!plugin) throw new Error(`Unknown plugin "${pluginId}".`);

    const enabledAt = enabled ? new Date().toISOString() : null;
    const state = await this.readState();
    state.plugins[pluginId] = { enabled, enabledAt };
    await this.writeState(state);

    return { ...plugin, enabled, enabledAt };
  }

  /**
   * The human-inspectable payload behind "source is one click away": literal
   * markdown, the mapping as formatted JSON, or the command a connector would
   * run. A connector's command is shown, never launched, from this method.
   */
  async readSource(pluginId: string): Promise<string> {
    const catalog = await this.list();
    const plugin = catalog.plugins.find((entry) => entry.manifest.id === pluginId);
    if (!plugin) throw new Error(`Unknown plugin "${pluginId}".`);

    const manifest = plugin.manifest;
    if (manifest.kind === "report-section") return manifest.markdown;
    if (manifest.kind === "csv-importer") return JSON.stringify(manifest.mapping, null, 2);
    return `command: ${manifest.command}\nargs: ${manifest.args.join(" ")}\n`;
  }

  private async pluginDirectories(): Promise<string[]> {
    try {
      const entries = await readdir(this.directory, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    } catch {
      return [];
    }
  }

  private async readState(): Promise<PersistedState> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.statePath, "utf8"));
      if (typeof parsed === "object" && parsed !== null) {
        const plugins = (parsed as PersistedState).plugins;
        if (typeof plugins === "object" && plugins !== null) return { plugins };
      }
    } catch {
      // A missing or hand-edited state file must never block startup: every
      // plugin simply reads as disabled.
    }
    return { ...EMPTY_STATE, plugins: {} };
  }

  private async writeState(state: PersistedState): Promise<void> {
    await mkdir(this.userDataDirectory, { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }
}


/** Turns a zod failure into one line the seller can act on. */
function describeIssues(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  return issues
    .map((issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`)
    .join("; ");
}
