/** Public surface of `@open-merchant/mcp` — the read-only MCP server lane. */
export { ReadOnlyProject } from "./project.js";
export {
  parseAssumptionsText,
  parseCompetitorsText,
  parseEvidenceText,
  parseManifestText,
  parseProvenanceJournalText,
  parseReportSectionsText,
  parseRunsJournalText,
  parseScenariosText,
} from "./project.js";
export {
  ARTIFACT_RESOURCES,
  ResourceNotAvailableError,
  SNAPSHOT_TEMPLATE,
  SNAPSHOT_URI_PREFIX,
  UnknownResourceError,
  listSnapshotResources,
  readResource,
} from "./resources.js";
export type { ArtifactResource, ReadResult } from "./resources.js";
export { createMcpServer } from "./server.js";
export { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "./version.js";
