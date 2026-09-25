import type { InstalledPlugin } from "./phase3";

export interface CsvImporterPreset {
  readonly id: string;
  readonly name: string;
  readonly mapping: Readonly<Record<string, string>>;
}

/**
 * The fields a competitor CSV import understands. A preset may name any of
 * these; anything else is ignored rather than passed along to the importer.
 */
const IMPORTABLE_FIELDS = ["product", "brand", "price", "marketplace", "url", "notes"] as const;

/**
 * Enabled csv-importer plugins, offered to the seller as mapping presets.
 *
 * This lives in `@open-merchant/shared` rather than `@open-merchant/core`
 * because the renderer needs it and core is node-only (it reads files, zips
 * archives, and touches `Buffer`). It is pure data manipulation over the plugin
 * contract — no I/O, no platform APIs.
 */
export function csvImporterPresets(plugins: readonly InstalledPlugin[]): CsvImporterPreset[] {
  const presets: CsvImporterPreset[] = [];
  for (const plugin of plugins) {
    const { manifest } = plugin;
    if (!plugin.enabled || manifest.kind !== "csv-importer") continue;
    presets.push({ id: manifest.id, name: manifest.name, mapping: manifest.mapping });
  }
  return presets;
}

/**
 * Intersects a preset with the headers actually present in the file. A preset is
 * a starting point, not a promise about someone else's export: an entry naming a
 * column this file does not have, or a field the importer does not understand, is
 * dropped rather than applied and left to fail at import time.
 */
export function applyCsvImporterPreset(
  mapping: Readonly<Record<string, string>>,
  headers: readonly string[],
): Record<string, string> {
  const present = new Set(headers);
  const applied: Record<string, string> = {};

  for (const field of IMPORTABLE_FIELDS) {
    const header = mapping[field];
    if (typeof header === "string" && present.has(header)) {
      applied[field] = header;
    }
  }

  return applied;
}
