import type { InstalledPlugin, ReportSections } from "@open-merchant/shared";

/**
 * Enabled report-section plugins append their static markdown to the section
 * they declare. A plugin contributes boilerplate only: it never reads project
 * data, so it needs no capability grant and there is nothing to resolve.
 *
 * The base is never mutated — the caller keeps ownership of the sections it
 * generated, and gets a new object back.
 */
export function appendPluginSections(
  base: ReportSections,
  plugins: InstalledPlugin[],
): ReportSections {
  const result: ReportSections = {
    decisionSummary: base.decisionSummary,
    marketObservations: [...base.marketObservations],
    risks: [...base.risks],
    opportunities: [...base.opportunities],
  };

  for (const plugin of plugins) {
    if (!plugin.enabled) continue;
    const manifest = plugin.manifest;
    if (manifest.kind !== "report-section") continue;

    if (manifest.section === "decisionSummary") {
      result.decisionSummary = `${result.decisionSummary}\n\n${manifest.markdown}`.trim();
    } else {
      result[manifest.section].push(manifest.markdown);
    }
  }

  return result;
}
