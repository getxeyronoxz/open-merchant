import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

import {
  isoDateTimeSchema,
  pluginManifestSchema,
  satisfiesMinimum,
  type InstalledPlugin,
  type PluginCatalog,
  type PluginManifest,
} from "@open-merchant/shared";

/**
 * The on-disk shape of one `plugin-state.json` entry. It is validated on read
 * so a hand-edited or partly-corrupted file can never hand the renderer a value
 * the shared contract would reject.
 */
const pluginStateEntrySchema = z.object({
  enabled: z.boolean(),
  enabledAt: isoDateTimeSchema.nullable(),
});
type PersistedState = { plugins: Record<string, z.infer<typeof pluginStateEntrySchema>> };

/**
 * Discovers capability-declared plugins in app data. A plugin is data, never
 * code: nothing here imports a plugin, and only a `connector` manifest names an
 * external command that the connector client spawns under its own controls.
 */
export class PluginStore {
  /**
   * `appVersion` is the running build's version, used to enforce each manifest's
   * `minAppVersion`. It is injected rather than read from a package.json so the
   * store cannot disagree with the version the app reports everywhere else, and
   * so a test can state the build it is testing against.
   *
   * With no version supplied the gate is inert and every valid manifest loads:
   * a store that cannot say what build it is should not guess a floor.
   */
  constructor(
    private readonly userDataDirectory: string,
    private readonly appVersion: string | null = null,
  ) {}

  private get directory(): string {
    return join(this.userDataDirectory, "plugins");
  }

  private get statePath(): string {
    return join(this.userDataDirectory, "plugin-state.json");
  }

  async list(): Promise<PluginCatalog> {
    const state = await this.readState();
    const broken: PluginCatalog["broken"] = [];
    const candidates: { directoryName: string; manifest: PluginManifest }[] = [];

    for (const { name: directoryName, isLink } of await this.pluginDirectories()) {
      if (isLink) {
        broken.push({
          directoryName,
          reason: "This folder is a symbolic link. Plugins are not followed through links.",
        });
        continue;
      }

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
      // `minAppVersion` is the field that stops a plugin loading against a build
      // it was never written for. It was declared, format-checked, and then never
      // compared with anything, so a plugin could require a version this app has
      // not reached and still load. An incompatible plugin is refused, not hidden:
      // it is listed with the reason, like every other refusal here.
      if (
        this.appVersion !== null &&
        !satisfiesMinimum(this.appVersion, parsed.data.minAppVersion)
      ) {
        broken.push({
          directoryName,
          reason:
            `Needs Open Merchant ${parsed.data.minAppVersion} or newer, and this is ` +
            `${this.appVersion}. The plugin was written for a later build than this one.`,
        });
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

    return { plugins, broken, directory: this.directory };
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

  private async pluginDirectories(): Promise<{ name: string; isLink: boolean }[]> {
    try {
      const entries = await readdir(this.directory, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
        .map((entry) => ({ name: entry.name, isLink: entry.isSymbolicLink() }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  private async readState(): Promise<PersistedState> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(this.statePath, "utf8"));
    } catch {
      return { plugins: {} };
    }
    const outer = z.object({ plugins: z.record(z.unknown()) }).safeParse(parsed);
    if (!outer.success) return { plugins: {} };

    // Each entry is validated on its own. One hand-edited entry must not
    // silently disable a plugin the seller deliberately turned on, and a bad
    // entry must never reach the renderer as a value the contract cannot parse.
    const plugins: PersistedState["plugins"] = {};
    for (const [pluginId, value] of Object.entries(outer.data.plugins)) {
      const entry = pluginStateEntrySchema.safeParse(value);
      if (entry.success) plugins[pluginId] = entry.data;
    }
    return { plugins };
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
