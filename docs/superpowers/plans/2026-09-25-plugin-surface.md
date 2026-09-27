# Plugin Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discover, inspect, and enable capability-declared local plugins from app data, with the two declarative kinds contributing to the report and the CSV import flow.

**Architecture:** A `PluginStore` in the Electron main process scans `<userData>/plugins/*/manifest.json`, validates each with the existing zod `pluginManifestSchema`, and merges enabled state from `plugin-state.json`. Everything crosses the standard five hops (shared zod contract → SDK client → main handler → store → renderer). No third-party JavaScript is ever imported into Electron; only `connector` plugins execute anything, as a scrubbed child process.

**Tech Stack:** TypeScript, zod, Electron main/preload, React, TanStack Query, Vitest, pnpm monorepo.

**Spec:** `docs/superpowers/specs/2026-09-25-plugin-surface-design.md`

## Global Constraints

- Commerce math runs only on arbitrary-precision decimals in `packages/core`. No binary floating point, ever. (No money math is added by this plan.)
- The renderer never imports Electron. Everything crosses the zod-validated IPC contract in `@open-merchant/shared` via `@open-merchant/sdk`.
- No cloud sync, accounts, teams, telemetry, payments, or autonomous browsing.
- API keys live encrypted via `safeStorage`; never in project folders, logs, IPC responses, or tests.
- No third-party JavaScript is imported into Electron. Only `connector` plugins spawn a process.
- `capabilities.network` is a disclosed contract approved by the user at enable time. It is **not** a technical control and must never be described in UI copy as one.
- Project files are canonical. Reject malformed data loudly; never silently skip or repair it.
- Commits carry no `Co-Authored-By` or other authorship trailer (`CLAUDE.md`).

## Review Focus

Five input classes the spec implies but no step above explicitly tests. Each has a pinned test in the task that owns the code.

1. A manifest whose directory name differs from its `id` (e.g. folder `evil/` containing `"id": "trusted"`) — a reasonable person expects refusal, not a shadowed catalog entry.
2. `plugin-state.json` corrupted or hand-edited to invalid JSON — expect the app to start and treat every plugin as disabled, not to crash on boot.
3. A connector declaring `writes: []` — expect a loud refusal naming the plugin, not a fetch that silently yields nothing.
4. Two plugins declaring the same `id` in different directories — expect both listed as broken with the collision named, not last-one-wins.
5. A `report-section` plugin enabled while the project has no generated report — expect it to contribute on the *next* generation without error, not to crash report rendering.

---

### Task 1: Land the Phase 3 contracts

361 lines of committed-nowhere work currently block every other task and fail lint. This makes it real and green before anything is built on it.

**Files:**
- Modify: `packages/shared/src/phase3.ts:4-10` (remove two unused imports)
- Add (no new source): commit existing `apps/desktop/src/main/connector-client.ts`, `apps/desktop/tests/connector-client.test.ts`, `packages/shared/src/phase3.ts`, and modifications to `apps/desktop/package.json`, `packages/shared/src/index.ts`, `packages/shared/src/provenance.ts`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: nothing
- Produces: `pluginManifestSchema`, `pluginCapabilitySchema`, `installedPluginSchema`, `draftRecordSchema`, `connectorResultSchema` exported from `@open-merchant/shared`; `fetchFromConnector` from `apps/desktop/src/main/connector-client.ts`

- [ ] **Step 1: Confirm the lint failure is exactly the two unused imports**

Run: `pnpm lint 2>&1 | grep "no-unused-vars"`
Expected: two lines naming `costAssumptionsSchema` and `economicsScenarioSchema` in `packages/shared/src/phase3.ts`

- [ ] **Step 2: Remove the unused imports**

In `packages/shared/src/phase3.ts`, change the import block from:

```ts
import {
  costAssumptionsSchema,
  economicsScenarioSchema,
  evidenceSourceSchema,
  isoDateTimeSchema,
  reportSectionsSchema,
} from "./artifacts";
```

to:

```ts
import {
  evidenceSourceSchema,
  isoDateTimeSchema,
  reportSectionsSchema,
} from "./artifacts";
```

- [ ] **Step 3: Verify lint, typecheck, and tests are green**

Run: `pnpm lint && pnpm typecheck && pnpm -r test`
Expected: lint exits 0, typecheck exits 0, all test files pass (baseline: 253 tests, 6 packages)

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/phase3.ts packages/shared/src/index.ts \
  packages/shared/src/provenance.ts apps/desktop/package.json \
  apps/desktop/src/main/connector-client.ts apps/desktop/tests/connector-client.test.ts \
  pnpm-lock.yaml
git commit -m "feat(phase-3): land connector client and plugin/review/currency contracts"
```

---

### Task 2: Plugin discovery and validation

**Files:**
- Create: `apps/desktop/src/main/plugin-store.ts`
- Create: `apps/desktop/tests/plugin-store.test.ts`

**Interfaces:**
- Consumes: `pluginManifestSchema`, `pluginCatalogSchema`, `installedPluginSchema`, `type InstalledPlugin`, `type PluginManifest` from `@open-merchant/shared`
- Produces: `export class PluginStore`, `export interface BrokenPlugin`

```ts
export interface BrokenPlugin {
  readonly directoryName: string;
  readonly reason: string;
}
```

- [ ] **Step 1: Write the failing discovery tests**

Create `apps/desktop/tests/plugin-store.test.ts`:

```ts
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PluginStore } from "../src/main/plugin-store";

const VALID_CONNECTOR = {
  id: "price-connector",
  name: "Price connector",
  version: "1.0.0",
  author: "A Seller",
  minAppVersion: "1.0.0",
  capabilities: { reads: ["market"], writes: ["drafts"], network: true },
  kind: "connector",
  description: "Fetches competitor prices.",
  toolName: "fetch_prices",
  command: "node",
  args: ["server.js"],
};

const VALID_SECTION = {
  id: "report-risks",
  name: "Risk boilerplate",
  version: "1.0.0",
  author: "A Seller",
  minAppVersion: "1.0.0",
  capabilities: { reads: [], writes: [], network: false },
  kind: "report-section",
  description: "Common failure modes.",
  section: "risks",
  markdown: "## Common failure modes\nConfirm supplier MOQ.",
};

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "om-plugins-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writePlugin(name: string, manifest: unknown): Promise<void> {
  const pluginDir = join(dir, "plugins", name);
  await mkdir(pluginDir, { recursive: true });
  await writeFile(join(pluginDir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

describe("PluginStore.list", () => {
  it("discovers a valid connector and a valid report section", async () => {
    await writePlugin("price-connector", VALID_CONNECTOR);
    await writePlugin("report-risks", VALID_SECTION);

    const catalog = await new PluginStore(dir).list();

    expect(catalog.broken).toEqual([]);
    expect(catalog.plugins.map((p) => p.manifest.id).sort()).toEqual([
      "price-connector",
      "report-risks",
    ]);
  });

  it("loads every plugin disabled by default", async () => {
    await writePlugin("report-risks", VALID_SECTION);

    const catalog = await new PluginStore(dir).list();

    expect(catalog.plugins[0].enabled).toBe(false);
    expect(catalog.plugins[0].enabledAt).toBeNull();
  });

  it("refuses a manifest with no author and reports the reason", async () => {
    const { author: _omitted, ...withoutAuthor } = VALID_SECTION;
    await writePlugin("report-risks", withoutAuthor);

    const catalog = await new PluginStore(dir).list();

    expect(catalog.plugins).toEqual([]);
    expect(catalog.broken).toHaveLength(1);
    expect(catalog.broken[0].directoryName).toBe("report-risks");
    expect(catalog.broken[0].reason).toMatch(/author/i);
  });

  it("refuses a manifest whose directory name differs from its id", async () => {
    await writePlugin("mismatched-folder", VALID_SECTION);

    const catalog = await new PluginStore(dir).list();

    expect(catalog.plugins).toEqual([]);
    expect(catalog.broken[0].reason).toMatch(/directory name/i);
  });

  it("reports two plugins claiming the same id as broken rather than picking one", async () => {
    const { id: _a, ...first } = VALID_SECTION;
    const { id: _b, ...second } = VALID_SECTION;
    await writePlugin("report-risks", { ...first, id: "report-risks" });
    await writePlugin("copy", { ...second, id: "report-risks" });

    const catalog = await new PluginStore(dir).list();

    expect(catalog.plugins).toEqual([]);
    expect(catalog.broken).toHaveLength(2);
    expect(catalog.broken[0].reason).toMatch(/duplicate/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/desktop && npx vitest run tests/plugin-store.test.ts`
Expected: FAIL — `Cannot find module '../src/main/plugin-store'`

- [ ] **Step 3: Write the minimal implementation**

Create `apps/desktop/src/main/plugin-store.ts`:

```ts
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { pluginManifestSchema, type InstalledPlugin } from "@open-merchant/shared";

export interface BrokenPlugin {
  readonly directoryName: string;
  readonly reason: string;
}

interface PersistedState {
  plugins: Record<string, { enabled: boolean; enabledAt: string | null }>;
}

const EMPTY_STATE: PersistedState = { plugins: {} };

/** Discovers capability-declared plugins in app data. No plugin code is ever imported. */
export class PluginStore {
  constructor(private readonly userDataDirectory: string) {}

  private get directory(): string {
    return join(this.userDataDirectory, "plugins");
  }

  private get statePath(): string {
    return join(this.userDataDirectory, "plugin-state.json");
  }

  async list(): Promise<{ plugins: InstalledPlugin[]; broken: BrokenPlugin[] }> {
    const state = await this.readState();
    const plugins: InstalledPlugin[] = [];
    const broken: BrokenPlugin[] = [];
    const seen = new Map<string, string>();

    let entries: string[];
    try {
      entries = (await readdir(this.directory, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    } catch {
      return { plugins, broken };
    }

    for (const directoryName of entries) {
      let raw: string;
      try {
        raw = await readFile(join(this.directory, directoryName, "manifest.json"), "utf8");
      } catch {
        broken.push({ directoryName, reason: "manifest.json is missing or unreadable." });
        continue;
      }

      const parsed = pluginManifestSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        broken.push({ directoryName, reason: describeIssues(parsed.error) });
        continue;
      }
      const manifest = parsed.data;
      if (manifest.id !== directoryName) {
        broken.push({
          directoryName,
          reason: `Directory name "${directoryName}" does not match manifest id "${manifest.id}".`,
        });
        continue;
      }
      const previous = seen.get(manifest.id);
      if (previous !== undefined) {
        broken.push({ directoryName, reason: `Duplicate plugin id "${manifest.id}" (also in "${previous}").` });
        continue;
      }
      seen.set(manifest.id, directoryName);

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

  private async readState(): Promise<PersistedState> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.statePath, "utf8"));
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as PersistedState).plugins === "object" &&
        (parsed as PersistedState).plugins !== null
      ) {
        return parsed as PersistedState;
      }
    } catch {
      // A missing or hand-edited state file must never block startup.
    }
    return EMPTY_STATE;
  }

  private async writeState(state: PersistedState): Promise<void> {
    await mkdir(this.userDataDirectory, { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }
}

/** Turns a zod error into one line a seller can act on. */
function describeIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`)
    .join("; ");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/desktop && npx vitest run tests/plugin-store.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/plugin-store.ts apps/desktop/tests/plugin-store.test.ts
git commit -m "feat(plugins): discover and validate capability-declared plugins"
```

---

### Task 3: Enabling, disabling, and reading plugin source

**Files:**
- Modify: `apps/desktop/src/main/plugin-store.ts`
- Modify: `apps/desktop/tests/plugin-store.test.ts`

**Interfaces:**
- Consumes: `PluginStore` from Task 2
- Produces: `setEnabled(pluginId: string, enabled: boolean): Promise<InstalledPlugin>` and `readSource(pluginId: string): Promise<string>`

- [ ] **Step 1: Write the failing tests**

Append to `apps/desktop/tests/plugin-store.test.ts`:

```ts
describe("PluginStore.setEnabled", () => {
  it("persists enabled state across store instances", async () => {
    await writePlugin("report-risks", VALID_SECTION);

    await new PluginStore(dir).setEnabled("report-risks", true);
    const catalog = await new PluginStore(dir).list();

    expect(catalog.plugins[0].enabled).toBe(true);
    expect(catalog.plugins[0].enabledAt).not.toBeNull();
  });

  it("disables a previously enabled plugin", async () => {
    await writePlugin("report-risks", VALID_SECTION);
    const store = new PluginStore(dir);
    await store.setEnabled("report-risks", true);

    const updated = await store.setEnabled("report-risks", false);

    expect(updated.enabled).toBe(false);
  });

  it("throws for an unknown plugin id", async () => {
    await expect(new PluginStore(dir).setEnabled("nope", true)).rejects.toThrow(/nope/);
  });

  it("treats a corrupt state file as everything disabled", async () => {
    await writePlugin("report-risks", VALID_SECTION);
    await writeFile(join(dir, "plugin-state.json"), "{ not json", "utf8");

    const catalog = await new PluginStore(dir).list();

    expect(catalog.plugins[0].enabled).toBe(false);
  });
});

describe("PluginStore.readSource", () => {
  it("returns the markdown for a report-section plugin", async () => {
    await writePlugin("report-risks", VALID_SECTION);

    expect(await new PluginStore(dir).readSource("report-risks")).toContain("Confirm supplier MOQ.");
  });

  it("returns the command and args for a connector plugin", async () => {
    await writePlugin("price-connector", VALID_CONNECTOR);

    const source = await new PluginStore(dir).readSource("price-connector");

    expect(source).toContain("node");
    expect(source).toContain("server.js");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/desktop && npx vitest run tests/plugin-store.test.ts`
Expected: FAIL — `setEnabled is not a function`

- [ ] **Step 3: Implement both methods**

Add to `PluginStore` in `apps/desktop/src/main/plugin-store.ts`:

```ts
  async setEnabled(pluginId: string, enabled: boolean): Promise<InstalledPlugin> {
    const catalog = await this.list();
    const plugin = catalog.plugins.find((entry) => entry.manifest.id === pluginId);
    if (!plugin) throw new Error(`Unknown plugin "${pluginId}".`);

    const state = await this.readState();
    const enabledAt = enabled ? new Date().toISOString() : null;
    state.plugins[pluginId] = { enabled, enabledAt };
    await this.writeState(state);

    return { ...plugin, enabled, enabledAt };
  }

  async readSource(pluginId: string): Promise<string> {
    const catalog = await this.list();
    const plugin = catalog.plugins.find((entry) => entry.manifest.id === pluginId);
    if (!plugin) throw new Error(`Unknown plugin "${pluginId}".`);

    const manifest = plugin.manifest;
    if (manifest.kind === "report-section") return manifest.markdown;
    if (manifest.kind === "csv-importer") return JSON.stringify(manifest.mapping, null, 2);
    return `command: ${manifest.command}\nargs: ${manifest.args.join(" ")}\n`;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/desktop && npx vitest run tests/plugin-store.test.ts`
Expected: PASS — 10 tests

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/plugin-store.ts apps/desktop/tests/plugin-store.test.ts
git commit -m "feat(plugins): enable, disable, and inspect plugin source"
```

---

### Task 4: The IPC contract and SDK client

**Files:**
- Modify: `packages/shared/src/phase3.ts` (add `brokenPluginSchema`, widen `pluginCatalogSchema`)
- Modify: `packages/shared/src/ipc.ts` (three channels)
- Modify: `packages/sdk/src/client.ts` (interface + impl)
- Modify: `packages/shared/tests/artifacts.test.ts` (channel assertions)
- Modify: `packages/sdk/src/mock.ts` (mock implementations)

**Interfaces:**
- Consumes: `installedPluginSchema`, `pluginManifestSchema` from Task 1
- Produces: channels `plugins/list`, `plugins/source`, `plugins/set-enabled`; client methods `listPlugins()`, `readPluginSource(pluginId)`, `setPluginEnabled(pluginId, enabled)`

- [ ] **Step 1: Write the failing contract test**

Append to `packages/shared/tests/artifacts.test.ts`:

```ts
it("declares the three plugin channels", () => {
  expect(ipcChannels).toContain("plugins/list");
  expect(ipcChannels).toContain("plugins/source");
  expect(ipcChannels).toContain("plugins/set-enabled");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @open-merchant/shared test`
Expected: FAIL — `expected [ ... ] to contain 'plugins/list'`

- [ ] **Step 3: Add `brokenPluginSchema` and widen the catalog**

In `packages/shared/src/phase3.ts`, replace the `pluginCatalogSchema` line with:

```ts
export const brokenPluginSchema = z.object({
  directoryName: z.string().min(1),
  reason: z.string().min(1),
});
export const pluginCatalogSchema = z.object({
  plugins: z.array(installedPluginSchema),
  broken: z.array(brokenPluginSchema),
});
export type BrokenPlugin = z.infer<typeof brokenPluginSchema>;
```

- [ ] **Step 4: Declare the channels**

In `packages/shared/src/ipc.ts`, add alongside the other channel entries:

```ts
  "plugins/list": {
    request: z.object({}),
    response: pluginCatalogSchema,
  },
  "plugins/source": {
    request: z.object({ pluginId: z.string().min(1) }),
    response: z.object({ source: z.string() }),
  },
  "plugins/set-enabled": {
    request: z.object({ pluginId: z.string().min(1), enabled: z.boolean() }),
    response: z.object({ plugin: installedPluginSchema }),
  },
```

Add `brokenPluginSchema` and `pluginCatalogSchema` to the existing import from `./phase3`.

- [ ] **Step 5: Add SDK client methods**

In `packages/sdk/src/client.ts`, add to the interface:

```ts
  listPlugins(): Promise<IpcResponse<"plugins/list">>;
  readPluginSource(pluginId: string): Promise<IpcResponse<"plugins/source">>;
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<IpcResponse<"plugins/set-enabled">>;
```

and to the implementation object:

```ts
    listPlugins: () => invoke(raw, "plugins/list", {}),
    readPluginSource: (pluginId) => invoke(raw, "plugins/source", { pluginId }),
    setPluginEnabled: (pluginId, enabled) => invoke(raw, "plugins/set-enabled", { pluginId, enabled }),
```

Add matching implementations to `packages/sdk/src/mock.ts` returning one report-section plugin and an empty `broken` array.

- [ ] **Step 6: Run the shared and SDK tests**

Run: `pnpm --filter @open-merchant/shared test && pnpm --filter @open-merchant/sdk test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/phase3.ts packages/shared/src/ipc.ts \
  packages/shared/tests/artifacts.test.ts packages/sdk/src/client.ts packages/sdk/src/mock.ts
git commit -m "feat(plugins): declare the plugin IPC contract and SDK methods"
```

---

### Task 5: Main-process handlers with journaled enable/disable

**Files:**
- Modify: `apps/desktop/src/main/ipc.ts`
- Modify: `apps/desktop/tests/service.integration.test.ts`

**Interfaces:**
- Consumes: `PluginStore` (Task 3), channels (Task 4), `runOperationSchema` values `pluginEnabled` / `pluginDisabled`
- Produces: three registered handlers

- [ ] **Step 1: Write the failing integration test**

Append to `apps/desktop/tests/service.integration.test.ts`:

```ts
it("journals pluginEnabled and pluginDisabled when a plugin is toggled", async () => {
  const { root } = await createProject();
  const pluginDir = join(userDataDir, "plugins", "report-risks");
  await mkdir(pluginDir, { recursive: true });
  await writeFile(
    join(pluginDir, "manifest.json"),
    JSON.stringify({
      id: "report-risks",
      name: "Risk boilerplate",
      version: "1.0.0",
      author: "A Seller",
      minAppVersion: "1.0.0",
      capabilities: { reads: [], writes: [], network: false },
      kind: "report-section",
      description: "Common failure modes.",
      section: "risks",
      markdown: "## Risks\nConfirm supplier MOQ.",
    }),
  );

  const store = new PluginStore(userDataDir);
  await store.setEnabled("report-risks", true);
  const runs = await readRuns(root);

  expect(runs.some((run) => run.operation === "pluginEnabled")).toBe(true);
});
```

Adjust the imports and helper names at the top of the file to match what that file already uses for project creation, user-data paths, and run-journal reads — do not invent new helpers.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/desktop && npx vitest run tests/service.integration.test.ts`
Expected: FAIL — no `pluginEnabled` run is journaled

- [ ] **Step 3: Register the handlers**

In `apps/desktop/src/main/ipc.ts`, construct `const plugins = new PluginStore(app.getPath("userData"));` beside the existing `RecentsStore` construction, then register:

```ts
  ipcMain.handle("plugins/list", async () => plugins.list());
  ipcMain.handle("plugins/source", async (_event, request) => ({
    source: await plugins.readSource(request.pluginId),
  }));
  ipcMain.handle("plugins/set-enabled", async (_event, request) => {
    const plugin = await plugins.setEnabled(request.pluginId, request.enabled);
    await service.journalPluginToggle(plugin, request.enabled);
    return { plugin };
  });
```

- [ ] **Step 4: Add the journaling method to the service**

In `apps/desktop/src/main/service.ts`, beside the other journal helpers:

```ts
  /** Enabling a plugin is a meaningful operation, so it lands in the run journal. */
  async journalPluginToggle(plugin: InstalledPlugin, enabled: boolean): Promise<void> {
    // Append a run record with operation pluginEnabled / pluginDisabled,
    // reusing the same append helper the existing snapshot capture uses.
  }
```

Follow the exact append shape already used by `captureMarketSnapshot`
(`apps/desktop/src/main/service.ts:656-666`) — same `startedAt`/`completedAt`/
`status`/`appVersion` fields, same `RunJournal` call. Do not invent a second
journaling path.

- [ ] **Step 5: Run the integration test**

Run: `cd apps/desktop && npx vitest run tests/service.integration.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/main/ipc.ts apps/desktop/src/main/service.ts \
  apps/desktop/tests/service.integration.test.ts
git commit -m "feat(plugins): journal plugin enable and disable"
```

---

### Task 6: The Plugins screen

**Files:**
- Create: `apps/desktop/src/renderer/src/features/workspace/screens/PluginsScreen.tsx`
- Modify: `apps/desktop/src/renderer/src/features/workspace/WorkspaceShell.tsx:31-34,92,261+`
- Modify: `apps/desktop/src/renderer/src/features/workspace/queries.ts`

**Interfaces:**
- Consumes: `listPlugins`, `readPluginSource`, `setPluginEnabled` (Task 4)
- Produces: `usePluginCatalog()`, `usePluginSource(pluginId)`, `useSetPluginEnabled()`; a `Plugins` section in the rail

- [ ] **Step 1: Add the queries**

In `apps/desktop/src/renderer/src/features/workspace/queries.ts`, following the existing query-hook pattern:

```ts
export function usePluginCatalog() {
  return useQuery({ queryKey: ["plugins"], queryFn: () => client.listPlugins() });
}

export function usePluginSource(pluginId: string | null) {
  return useQuery({
    queryKey: ["plugins", "source", pluginId],
    queryFn: () => client.readPluginSource(pluginId as string),
    enabled: pluginId !== null,
  });
}

export function useSetPluginEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) =>
      client.setPluginEnabled(pluginId, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plugins"] }),
  });
}
```

- [ ] **Step 2: Write the screen**

Create `PluginsScreen.tsx` rendering, in order:

1. `<EmptyState>` when `catalog.plugins.length === 0 && catalog.broken.length === 0`, titled "No plugins installed", with body text naming the app-data `plugins` folder.
2. One row per installed plugin: name, `id`, version, author, kind, and a toggle button labelled Enable / Disable.
3. Selecting a row loads `usePluginSource(id)` and shows the source in a `<pre>`; the toggle for a `connector` with `capabilities.network === true` additionally renders the literal line **"This plugin may reach the internet."** — a disclosure, not a restriction.
4. A "Broken plugins" section listing each `directoryName` with its `reason`.

Use the existing `EmptyState` component from `@open-merchant/ui` and the existing `om-*` class names. Do not introduce new CSS primitives.

- [ ] **Step 3: Register the section**

In `WorkspaceShell.tsx`, add to `assistantSections`:

```ts
  { name: "Plugins", label: "Plugins" },
```

and add to the `Stage` switch:

```tsx
    case "Plugins":
      return <PluginsScreen />;
```

Extend `SectionName` to include `"Plugins"`. The Alt+digit range derives from `shortcutSections` and widens to nine automatically.

- [ ] **Step 4: Update the shortcut copy**

`README.md` and `CHANGELOG.md` say "Alt+1…8". Change to "Alt+1…9" and mention Plugins.

- [ ] **Step 5: Verify the renderer builds and typechecks**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer/src/features/workspace/screens/PluginsScreen.tsx \
  apps/desktop/src/renderer/src/features/workspace/WorkspaceShell.tsx \
  apps/desktop/src/renderer/src/features/workspace/queries.ts README.md CHANGELOG.md
git commit -m "feat(plugins): settings screen for inspecting and enabling plugins"
```

---

### Task 7: A report-section plugin contributes to the report

**Files:**
- Modify: `apps/desktop/src/main/service.ts` (report generation)
- Create: `packages/core/src/plugin-sections.ts`
- Create: `packages/core/tests/plugin-sections.test.ts`

**Interfaces:**
- Consumes: `PluginStore`, `PluginManifest` kind `report-section`, `reportSectionsSchema`
- Produces: `export function appendPluginSections(base: ReportSections, plugins: InstalledPlugin[]): ReportSections`

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/plugin-sections.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { appendPluginSections } from "../src/plugin-sections";

const base = { decisionSummary: "Summary.", marketObservations: [], risks: [], opportunities: [] };

function sectionPlugin(id: string, section: "risks" | "opportunities", markdown: string) {
  return {
    manifest: {
      id,
      name: id,
      version: "1.0.0",
      author: "A Seller",
      minAppVersion: "1.0.0",
      capabilities: { reads: [], writes: [], network: false },
      kind: "report-section" as const,
      description: "A section.",
      section,
      markdown,
    },
    directory: "C:/plugins/" + id,
    enabled: true,
    enabledAt: null,
  };
}

describe("appendPluginSections", () => {
  it("appends a plugin's markdown to its declared section", () => {
    const result = appendPluginSections(base, [sectionPlugin("risks-1", "risks", "## Watch MOQ")]);

    expect(result.risks).toEqual(["## Watch MOQ"]);
    expect(result.opportunities).toEqual([]);
  });

  it("keeps existing entries and appends after them", () => {
    const result = appendPluginSections({ ...base, risks: ["Existing."] }, [
      sectionPlugin("risks-1", "risks", "## Watch MOQ"),
    ]);

    expect(result.risks).toEqual(["Existing.", "## Watch MOQ"]);
  });

  it("ignores disabled plugins and non-section kinds", () => {
    const disabled = { ...sectionPlugin("risks-1", "risks", "## Watch MOQ"), enabled: false };

    const result = appendPluginSections(base, [disabled]);

    expect(result.risks).toEqual([]);
  });

  it("returns the base unchanged when there are no plugins", () => {
    expect(appendPluginSections(base, [])).toEqual(base);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @open-merchant/core test`
Expected: FAIL — `Cannot find module '../src/plugin-sections'`

- [ ] **Step 3: Implement**

Create `packages/core/src/plugin-sections.ts`:

```ts
import type { InstalledPlugin } from "@open-merchant/shared";

type Sections = {
  decisionSummary: string;
  marketObservations: string[];
  risks: string[];
  opportunities: string[];
};

/**
 * Enabled report-section plugins append static markdown to their declared
 * section. A plugin contributes boilerplate only: it never reads project data,
 * so it needs no capability grant and there is nothing to resolve.
 */
export function appendPluginSections(
  base: Sections,
  plugins: InstalledPlugin[],
): Sections {
  const result: Sections = {
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
```

Export it from `packages/core/src/index.ts`.

- [ ] **Step 4: Wire it into report generation**

In `apps/desktop/src/main/service.ts`, in the report-generation path, after the sections are produced and before the report artifact is written:

```ts
const sections = appendPluginSections(drafted, enabledReportSectionPlugins(this.plugins));
```

Obtain `enabledReportSectionPlugins` by listing the `PluginStore` and filtering `enabled && manifest.kind === "report-section"`.

- [ ] **Step 5: Run the core and desktop tests**

Run: `pnpm --filter @open-merchant/core test && pnpm --filter @open-merchant/desktop test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/plugin-sections.ts packages/core/src/index.ts \
  packages/core/tests/plugin-sections.test.ts apps/desktop/src/main/service.ts
git commit -m "feat(plugins): enabled report sections contribute to the report"
```

---

### Task 8: A csv-importer plugin supplies a mapping preset

**Files:**
- Modify: `apps/desktop/src/renderer/src/features/workspace/screens/CompetitorsScreen.tsx` (import mapping step)
- Modify: `apps/desktop/src/renderer/src/features/workspace/queries.ts`

**Interfaces:**
- Consumes: `usePluginCatalog()` (Task 6), the existing `importCompetitorsCsv` mutation
- Produces: a preset selector above the manual column-mapping selects

- [ ] **Step 1: Add a filtered query**

In `queries.ts`:

```ts
export function useCsvImporterPresets() {
  const catalog = usePluginCatalog();
  return (catalog.data?.plugins ?? [])
    .filter((plugin) => plugin.enabled && plugin.manifest.kind === "csv-importer")
    .map((plugin) => ({ id: plugin.manifest.id, name: plugin.manifest.name, mapping: plugin.manifest.mapping }));
}
```

- [ ] **Step 2: Add the selector to the import step**

In `CompetitorsScreen.tsx`, immediately above the existing per-column mapping `<select>`s, render a preset dropdown. Choosing a preset replaces the current mapping state with the plugin's `mapping`; the manual selects remain editable afterwards, so a preset is a starting point and not a lock-in.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm --filter @open-merchant/desktop test`
Expected: all exit 0

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/renderer/src/features/workspace/queries.ts \
  apps/desktop/src/renderer/src/features/workspace/screens/CompetitorsScreen.tsx
git commit -m "feat(plugins): csv importer plugins supply column-mapping presets"
```

---

### Task 9: Full verification

**Files:** none

- [ ] **Step 1: Run the whole gate**

Run: `pnpm -r test && pnpm lint && pnpm typecheck`
Expected: all exit 0. Test count must be at least the 253 baseline plus the 15 added here.

- [ ] **Step 2: Run the Electron e2e suite**

Run: `pnpm --filter @open-merchant/desktop test:e2e`
Expected: PASS, including the existing Draft Desk smoke segment

- [ ] **Step 3: Confirm no plugin code path imports third-party JavaScript**

Run: `grep -rn "import(" apps/desktop/src/main/plugin-store.ts`
Expected: no matches

- [ ] **Step 4: Commit any residual formatting**

```bash
git status --short
git add -A
git commit -m "chore(plugins): final verification pass"
```

---

## Definition of done

All five spec §8 criteria met, and the full gate green. The item-3 follow-on (connector
fetch button, Draft Desk routing for connector drafts, draft persistence) is a
separate plan and is not started by this one.
