import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import {
  SCHEMA_VERSION,
  competitorSchema,
  costAssumptionsSchema,
  economicsScenarioSchema,
  evidenceSourceSchema,
  manifestSchema,
  reportSectionsSchema,
  type ArtifactFingerprint,
  type Competitor,
  type CostAssumptions,
  type EconomicsScenario,
  type EvidenceSource,
  type Manifest,
  type ReportSections,
} from "@open-merchant/shared";

import { writeFileAtomically } from "./atomic";
import { fingerprintContents } from "./fingerprint";
import {
  ArtifactPaths,
  WORKSPACE_DIR,
  readArtifactIfPresent,
  resolveKnownArtifact,
} from "./layout";
import { RunJournal } from "./provenance";
import { projectFolderName } from "./workspace";
import {
  validateAssumptions,
  validateCompetitors,
  validateEvidenceSources,
  validateObjective,
  validateProjectName,
} from "./validation";

/**
 * A user-owned project folder. All reads and writes go through the known
 * layout with atomic replacement; malformed data is rejected loudly on both
 * load and save — never silently repaired.
 */

export interface CreateProjectInput {
  readonly parentDirectory: string;
  readonly name: string;
  readonly objective: string;
  readonly currency: string;
}

export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

export function emptyAssumptions(currency: string): CostAssumptions {
  return costAssumptionsSchema.parse({
    currency,
    acquisitionCost: "0.00",
    shippingCost: "0.00",
    marketplaceFeeRate: "0.00",
    paymentFeeRate: "0.00",
    otherCosts: "0.00",
    scenarioPrices: { low: null, base: null, high: null },
  });
}

const EMPTY_SECTIONS: ReportSections = reportSectionsSchema.parse({
  decisionSummary: "",
  marketObservations: [],
  risks: [],
  opportunities: [],
});

export class WorkspaceStore {
  private constructor(
    readonly root: string,
    private manifestValue: Manifest,
    readonly journal: RunJournal,
  ) {}

  static async create(input: CreateProjectInput): Promise<WorkspaceStore> {
    const name = input.name.trim();
    const objective = input.objective.trim();
    validateProjectName(name);
    validateObjective(objective);

    const root = join(input.parentDirectory, projectFolderName(name));
    let claimed = false;
    try {
      try {
        await mkdir(root);
        claimed = true;
        for (const dir of [WORKSPACE_DIR, "evidence", "market", "economics", "reports", "ai"]) {
          await mkdir(join(root, dir));
        }
      } catch (error) {
        if (!claimed && (error as NodeJS.ErrnoException).code === "EEXIST") {
          throw new WorkspaceError(`A project folder already exists at ${root}`);
        }
        throw error;
      }

      const now = new Date().toISOString();
      const manifest = manifestSchema.parse({
        schemaVersion: SCHEMA_VERSION,
        projectId: crypto.randomUUID(),
        name,
        objective,
        currency: input.currency.trim(),
        createdAt: now,
        updatedAt: now,
      });

      const store = new WorkspaceStore(
        root,
        manifest,
        new RunJournal(join(root, ArtifactPaths.runs), join(root, ArtifactPaths.provenance)),
      );
      await store.writeManifestFile(manifest);
      await writeFileAtomically(join(root, ArtifactPaths.evidence), "");
      await store.saveCompetitors([]);
      await store.saveAssumptions(emptyAssumptions(manifest.currency));
      await store.saveReportSections(EMPTY_SECTIONS);
      return store;
    } catch (error) {
      if (claimed) await rm(root, { recursive: true, force: true });
      throw error;
    }
  }

  static async open(root: string): Promise<WorkspaceStore> {
    let stats;
    try {
      stats = await stat(root);
    } catch {
      throw new WorkspaceError(`No project folder at ${root}`);
    }
    if (!stats.isDirectory()) throw new WorkspaceError(`No project folder at ${root}`);

    const raw = await readArtifactIfPresent(await resolveKnownArtifact(root, ArtifactPaths.manifest));
    if (raw === null) {
      throw new WorkspaceError("That folder is not an Open Merchant project.");
    }
    let manifest;
    try {
      manifest = manifestSchema.parse(JSON.parse(raw));
    } catch (error) {
      throw new WorkspaceError(
        `This project's manifest is malformed and was left unchanged: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return new WorkspaceStore(
      root,
      manifest,
      new RunJournal(join(root, ArtifactPaths.runs), join(root, ArtifactPaths.provenance)),
    );
  }

  get manifest(): Manifest {
    return this.manifestValue;
  }

  /** Saves name/objective changes; returns the manifest with a bumped updatedAt. */
  async saveManifest(changes: { name?: string; objective?: string }): Promise<Manifest> {
    const next: Manifest = {
      ...this.manifestValue,
      name: (changes.name ?? this.manifestValue.name).trim(),
      objective: (changes.objective ?? this.manifestValue.objective).trim(),
      updatedAt: new Date().toISOString(),
    };
    await this.writeManifestFile(manifestSchema.parse(next));
    this.manifestValue = next;
    return next;
  }

  // --- evidence ------------------------------------------------------------

  async loadEvidence(): Promise<EvidenceSource[]> {
    const raw = await this.readArtifactOrEmpty(ArtifactPaths.evidence);
    const sources = raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => evidenceSourceSchema.parse(JSON.parse(line)));
    validateEvidenceSources(sources);
    return sources;
  }

  async saveEvidence(sources: EvidenceSource[]): Promise<void> {
    validateEvidenceSources(evidenceSourceSchema.array().parse(sources));
    const contents = `${sources.map((source) => JSON.stringify(source)).join("\n")}${sources.length > 0 ? "\n" : ""}`;
    await writeFileAtomically(join(this.root, ...ArtifactPaths.evidence.split("/")), contents);
  }

  // --- competitors ----------------------------------------------------------

  async loadCompetitors(): Promise<Competitor[]> {
    const raw = await this.readArtifactOrEmpty(ArtifactPaths.competitors);
    const competitors = competitorSchema.array().parse(JSON.parse(raw || "[]"));
    validateCompetitors(competitors, this.manifestValue.currency);
    return competitors;
  }

  async saveCompetitors(competitors: Competitor[]): Promise<void> {
    validateCompetitors(competitorSchema.array().parse(competitors), this.manifestValue.currency);
    await writeFileAtomically(
      join(this.root, ...ArtifactPaths.competitors.split("/")),
      `${JSON.stringify(competitorSchema.array().parse(competitors), null, 2)}\n`,
    );
  }

  // --- economics -------------------------------------------------------------

  async loadAssumptions(): Promise<CostAssumptions> {
    const raw = await this.readArtifactOrEmpty(ArtifactPaths.assumptions);
    const assumptions = costAssumptionsSchema.parse(JSON.parse(raw));
    validateAssumptions(assumptions, this.manifestValue.currency);
    return assumptions;
  }

  async saveAssumptions(assumptions: CostAssumptions): Promise<void> {
    const parsed = costAssumptionsSchema.parse(assumptions);
    validateAssumptions(parsed, this.manifestValue.currency);
    await writeFileAtomically(
      join(this.root, ...ArtifactPaths.assumptions.split("/")),
      `${JSON.stringify(parsed, null, 2)}\n`,
    );
  }

  async saveScenarios(scenarios: EconomicsScenario[]): Promise<ArtifactFingerprint> {
    const parsed = economicsScenarioSchema.array().parse(scenarios);
    const contents = `${JSON.stringify(parsed, null, 2)}\n`;
    await writeFileAtomically(join(this.root, ...ArtifactPaths.scenarios.split("/")), contents);
    return fingerprintContents(ArtifactPaths.scenarios, contents);
  }

  async loadScenarios(): Promise<EconomicsScenario[]> {
    const raw = await this.readArtifactOrEmpty(ArtifactPaths.scenarios);
    return economicsScenarioSchema.array().parse(JSON.parse(raw || "[]"));
  }

  // --- report ------------------------------------------------------------------

  async loadReportSections(): Promise<ReportSections> {
    const raw = await this.readArtifactOrEmpty(ArtifactPaths.reportSections);
    return reportSectionsSchema.parse(JSON.parse(raw || "{}"));
  }

  async saveReportSections(sections: ReportSections): Promise<void> {
    const parsed = reportSectionsSchema.parse(sections);
    await writeFileAtomically(
      join(this.root, ...ArtifactPaths.reportSections.split("/")),
      `${JSON.stringify(parsed, null, 2)}\n`,
    );
  }

  async writeOpportunityReport(markdown: string): Promise<ArtifactFingerprint> {
    await writeFileAtomically(join(this.root, ...ArtifactPaths.opportunityReport.split("/")), markdown);
    return fingerprintContents(ArtifactPaths.opportunityReport, markdown);
  }

  async loadOpportunityReport(): Promise<string | null> {
    return readArtifactIfPresent(await resolveKnownArtifact(this.root, ArtifactPaths.opportunityReport));
  }

  // --- artifact inspection ------------------------------------------------------

  async listArtifacts(): Promise<{ path: string; exists: boolean }[]> {
    const entries: { path: string; exists: boolean }[] = [];
    for (const relative of Object.values(ArtifactPaths)) {
      const resolved = await resolveKnownArtifact(this.root, relative);
      const present = await readArtifactIfPresent(resolved);
      entries.push({ path: relative, exists: present !== null });
    }
    return entries;
  }

  async readArtifactText(relativePath: string): Promise<string> {
    const resolved = await resolveKnownArtifact(this.root, relativePath);
    const text = await readArtifactIfPresent(resolved);
    if (text === null) throw new WorkspaceError(`Artifact does not exist yet: ${relativePath}`);
    return text;
  }

  // --- internals ---------------------------------------------------------------

  private async writeManifestFile(manifest: Manifest): Promise<void> {
    await writeFileAtomically(
      join(this.root, ...ArtifactPaths.manifest.split("/")),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  private async readArtifactOrEmpty(relativePath: string): Promise<string> {
    const resolved = await resolveKnownArtifact(this.root, relativePath);
    return (await readArtifactIfPresent(resolved)) ?? "";
  }
}
