# MCP Connector Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a seller press a button, fetch market data from an enabled connector, and review the result as drafts in the Draft Desk before a human accepts it.

**Architecture:** A new `connectors/fetch` IPC channel carries `{root, pluginId, query}` to the main process. `MerchantService.fetchFromConnector` looks the plugin up in the `PluginStore`, calls the already-shipped `fetchFromConnector` client, converts the result into `draftRecordSchema` drafts carrying a `connectorOrigin`, and journals a `connectorFetched` run. The Draft Desk learns to render a connector origin. Nothing reaches the project until Accept.

**Tech Stack:** TypeScript, zod, Electron main/preload, React, TanStack Query, Vitest, `@modelcontextprotocol/client` v2.

**Spec:** `docs/superpowers/specs/2026-09-25-connector-client-design.md`

## Global Constraints

- A connector's output is a **draft**, never project data. Only a human Accept writes, through the existing `evidence/save` / `competitors/save` channels.
- Fetches are **explicit button presses**. No polling, no crawling, no background work, no timers.
- Commerce math runs only on arbitrary-precision decimals in `packages/core`. No binary floating point. (This item adds no arithmetic — a connector price crosses the same `moneyStringSchema` boundary as a typed one.)
- The renderer never imports Electron and never imports the main process. Everything crosses the zod-validated contract in `@open-merchant/shared` via `@open-merchant/sdk`.
- `capabilities.network` is a **disclosed contract**, never described as a restriction this app enforces. Node cannot stop a child process opening a socket.
- No cloud sync, accounts, telemetry, payments, or autonomous browsing.
- Commits carry no `Co-Authored-By` or authorship trailer (`CLAUDE.md`).

## Review Focus

Five input classes the spec implies but no step above tests. Each is pinned below.

1. **A connector fetch that throws mid-call** — the seller's existing evidence and competitors must be exactly as they were, with no partial write and no half-journaled run.
2. **A connector returning an empty result** (valid schema, zero evidence and zero competitors) — expect a coded refusal, not a silent no-op that looks like a successful fetch of nothing.
3. **A connector returning prices that are not valid money strings** — expect `connectorResultSchema` to refuse the whole response, not to coerce `"1,299.00"` or `"$12.99"` into a number.
4. **Two fetches from the same connector in one session** — the second must not collide with the first's draft ids, or Accept would discard the wrong item.
5. **A connector draft accepted after the seller edited it** — the edit must be what gets written, and the `connectorOrigin` must survive the edit (provenance describes where it came from, not what it finally says).

---

### Task 1: A fixture connector for the tests

**Files:**
- Create: `apps/desktop/tests/fixtures/connector-plugin.ts`

**Interfaces:**
- Produces: `writeConnectorPlugin(userData: string, options?): Promise<string>` — writes a valid enabled-by-choice connector manifest into `<userData>/plugins/…` and returns its id.

- [ ] **Step 1: Write the fixture**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const CONNECTOR_ID = "sample-market";

/** Writes a valid connector manifest into app data and returns its id. */
export async function writeConnectorPlugin(
  userData: string,
  overrides: { id?: string; enabled?: boolean; writes?: string[] } = {},
): Promise<string> {
  const id = overrides.id ?? CONNECTOR_ID;
  const dir = join(userData, "plugins", id);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "manifest.json"),
    `${JSON.stringify(
      {
        id,
        name: "Sample market",
        version: "1.0.0",
        author: "Open Merchant",
        minAppVersion: "1.0.0",
        capabilities: {
          reads: ["market"],
          writes: overrides.writes ?? ["drafts"],
          network: true,
        },
        kind: "connector",
        description: "A sample market-data connector used by the test suite.",
        toolName: "fetch_market",
        command: "node",
        args: ["server.js"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return id;
}
```

- [ ] **Step 2: Verify it typechecks and that the manifest satisfies the real schema**

Add to `apps/desktop/tests/connector-client.test.ts` a case that calls `writeConnectorPlugin`, then `new PluginStore(dir).list()` and asserts one valid, non-broken plugin comes back. Run it; expect PASS once the store is in place. Commit.

```bash
git add apps/desktop/tests/fixtures/connector-plugin.ts apps/desktop/tests/connector-client.test.ts
git commit -m "test(plugins): add a fixture connector for the suite"
```

---

### Task 2: The IPC contract and SDK method

**Files:**
- Modify: `packages/shared/src/ipc.ts`
- Modify: `packages/shared/tests/artifacts.test.ts`
- Modify: `packages/sdk/src/client.ts`
- Modify: `packages/sdk/src/mock.ts`
- Modify: `packages/sdk/tests/mock-client.test.ts`

**Interfaces:**
- Consumes: `draftRecordSchema` (exists), `isoDateTimeSchema` (exists)
- Produces: channel `connectors/fetch`; client method `fetchFromConnector(root, pluginId, query)`

- [ ] **Step 1: Write the failing contract test**

Append `"connectors/fetch"` to the expected-channel array in the
`describe("IPC contract map")` block of `packages/shared/tests/artifacts.test.ts`.

Run: `pnpm --filter @open-merchant/shared test`
Expected: FAIL — `expected [ … ] to include 'connectors/fetch'`

- [ ] **Step 2: Declare the channel**

In `packages/shared/src/ipc.ts`, add alongside the other channels:

```ts
  "connectors/fetch": {
    request: z.object({ root: z.string(), pluginId: z.string().min(1), query: z.string().min(1) }),
    response: z.object({ drafts: z.array(draftRecordSchema).min(1), fetchedAt: isoDateTimeSchema }),
  },
```

Add `draftRecordSchema` to the existing import from `./phase3`.

- [ ] **Step 3: Add the SDK method**

Interface: `fetchFromConnector(root: string, pluginId: string, query: string): Promise<IpcResponse<"connectors/fetch">>;`
Impl: `fetchFromConnector: (root, pluginId, query) => invoke(raw, "connectors/fetch", { root, pluginId, query }),`

- [ ] **Step 4: Write the failing mock test, then implement the mock**

In `mock-client.test.ts`:

```ts
  it("returns connector drafts from the mock without writing to the project", async () => {
    const mock = createMockDesktopClient();
    const created = await mock.createProject({ name: "P", objective: "O", currency: "INR", parentDirectory: process.cwd() });

    const result = await mock.fetchFromConnector(created.root, "sample-market", "keyboard");

    expect(result.drafts.length).toBeGreaterThan(0);
    expect(result.drafts[0]?.origin.kind).toBe("connector");
    expect((await mock.loadEvidence(created.root)).evidence).toEqual([]);
  });
```

Run it; expect FAIL. Then add a `fetchFromConnector` to `mock.ts` returning two
drafts (one evidence, one competitors) with a `connectorOrigin`, writing nothing.
Run again; expect PASS.

- [ ] **Step 5: Full gate and commit**

```bash
pnpm -r test && pnpm lint && pnpm typecheck
git add packages/shared packages/sdk
git commit -m "feat(connectors): declare the connector fetch contract and SDK method"
```

---

### Task 3: The service method — drafts, not data

**Files:**
- Create: `apps/desktop/tests/connector-fetch.test.ts`
- Modify: `apps/desktop/src/main/service.ts`
- Modify: `apps/desktop/src/main/ipc.ts`
- Modify: `apps/desktop/src/main/index.ts`

**Interfaces:**
- Consumes: `fetchFromConnector` from `connector-client.ts`; `PluginStore`; `RunJournal`
- Produces: `MerchantService.fetchFromConnector(root, pluginId, query, plugins)`; the `connectors/fetch` handler

- [ ] **Step 1: Write the failing service test**

Create `apps/desktop/tests/connector-fetch.test.ts`. The test must **inject a fake
client** so no real process spawns — pass a `ConnectorClientFactory` through.
Extend the service signature to accept an optional factory defaulting to the real one:

```ts
async fetchFromConnector(
  root: string,
  pluginId: string,
  query: string,
  createClient: ConnectorClientFactory = () => new Client({ name: "open-merchant", version: APP_VERSION }),
): Promise<{ drafts: DraftRecord[]; fetchedAt: string }> {
```

Tests to write, all failing first:

1. produces evidence and competitor drafts from an enabled connector
2. every draft's origin is a connector carrying the plugin id and a 64-char hex hash
3. the project has no evidence, no competitors, and no provenance records after a fetch
4. a `connectorFetched` run is journaled in that project's `runs.jsonl`
5. a disabled connector is refused with a coded error
6. a plugin id that is not a connector is refused
7. an empty result from the connector is refused
8. a connector that throws leaves the project completely untouched (Review Focus #1)
9. two fetches produce non-colliding draft ids (Review Focus #4)

- [ ] **Step 2: Run them; expect failure on the missing method**

Run: `cd apps/desktop && npx vitest run tests/connector-fetch.test.ts`
Expected: FAIL — `service.fetchFromConnector is not a function`

- [ ] **Step 3: Implement**

In `MerchantService`:

```ts
async fetchFromConnector(root, pluginId, query, createClient = defaultConnectorClient) {
  const store = await this.openStore(root);
  const catalog = await this.plugins?.list() ?? { plugins: [], broken: [] };
  const plugin = catalog.plugins.find((entry) => entry.manifest.id === pluginId);
  if (!plugin || plugin.manifest.kind !== "connector") {
    throw new AppError({ code: "not-found", message: `No enabled connector named "${pluginId}".` });
  }
  if (!plugin.enabled) {
    throw new AppError({ code: "not-found", message: `Connector "${pluginId}" is disabled.` });
  }
  const fetchedAt = new Date().toISOString();
  const result = await fetchFromConnector(plugin.manifest, plugin.directory, { query }, createClient);
  const origin: ConnectorOrigin = {
    kind: "connector", connectorId: pluginId, pluginId, fetchedAt,
    rawResponseHash: result.rawResponseHash,
  };
  const drafts: DraftRecord[] = [];
  if (result.result.evidence.length > 0) {
    drafts.push({ id: `DRAFT-${pluginId}-${fetchedAt.replace(/\D/gu, "")}-E`,
      kind: "evidence", origin, createdAt: fetchedAt, value: result.result.evidence[0]! });
  }
  if (result.result.competitors.length > 0) {
    drafts.push({ id: `DRAFT-${pluginId}-${fetchedAt.replace(/\D/gu, "")}-C`,
      kind: "competitors", origin, createdAt: fetchedAt, value: result.result.competitors });
  }
  // journal connectorFetched, then return. Nothing is written to the project.
  return { drafts, fetchedAt };
}
```

Journal the `connectorFetched` run through the same `store.journal.appendRun` shape
`captureMarketSnapshot` uses (`service.ts:656-666`).

- [ ] **Step 4: Register the handler and pass the PluginStore**

`registerIpcHandlers` gains `connectors/fetch` delegating to
`service.fetchFromConnector(root, pluginId, query)`. Confirm `MerchantService`
receives the same `PluginStore` instance `index.ts` already constructs — it does,
from item 5.

- [ ] **Step 5: Full gate and commit**

```bash
pnpm -r test && pnpm lint && pnpm typecheck
git add apps/desktop/src/main apps/desktop/tests/connector-fetch.test.ts
git commit -m "feat(connectors): fetch from a connector into drafts, never into data"
```

---

### Task 4: The Draft Desk learns a connector origin

**Files:**
- Create: `apps/desktop/src/renderer/src/features/workspace/screens/DraftOriginPanel.tsx`
- Create: `apps/desktop/src/renderer/src/features/workspace/screens/DraftOriginPanel.test.tsx`
- Modify: `apps/desktop/src/renderer/src/features/workspace/screens/DraftDeskScreen.tsx`

**Interfaces:**
- Consumes: `GenerationOrigin`
- Produces: `DraftOriginPanel({ origin }: { origin: GenerationOrigin })`

- [ ] **Step 1: Write the failing test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftOriginPanel } from "./DraftOriginPanel";

const AI_ORIGIN = { kind: "ai", agentId: "planner", providerId: "anthropic",
  modelId: "claude", promptHash: "a".repeat(64) } as const;
const CONNECTOR_ORIGIN = { kind: "connector", connectorId: "sample-market",
  pluginId: "sample-market", fetchedAt: "2026-09-25T00:00:00.000Z",
  rawResponseHash: "b".repeat(64) } as const;

describe("DraftOriginPanel", () => {
  it("shows agent, model and prompt hash for an AI draft", () => {
    const html = renderToStaticMarkup(<DraftOriginPanel origin={AI_ORIGIN} />);
    expect(html).toContain("planner");
    expect(html).toContain("Prompt hash");
    expect(html).not.toContain("Raw response hash");
  });

  it("shows connector, plugin, fetch time and raw hash for a connector draft", () => {
    const html = renderToStaticMarkup(<DraftOriginPanel origin={CONNECTOR_ORIGIN} />);
    expect(html).toContain("sample-market");
    expect(html).toContain("Raw response hash");
    expect(html).not.toContain("Prompt hash");
  });

  it("does not claim a connector draft came from a model", () => {
    const html = renderToStaticMarkup(<DraftOriginPanel origin={CONNECTOR_ORIGIN} />);
    expect(html).not.toContain("Provider / model");
  });
});
```

Run; expect FAIL (module missing).

- [ ] **Step 2: Implement `DraftOriginPanel`**

Branch on `origin.kind`. For `connector`, render `LedgerRow`s for Connector,
Plugin, Fetched at, and Raw response hash (truncate the hash to 12 chars with a
`title` carrying the full value). For `ai`, render today's three rows unchanged.
For `user`, one row. Set `aria-label="Draft provenance"`.

- [ ] **Step 3: Widen `DraftRecord` and swap the block in**

In `DraftDeskScreen.tsx`, change the union's `origin: AiOrigin` to
`origin: GenerationOrigin`, and replace the hand-rolled block at `:378-387` with
`<DraftOriginPanel origin={active.origin} />`.

- [ ] **Step 4: Full gate and commit**

```bash
pnpm -r test && pnpm lint && pnpm typecheck
git add apps/desktop/src/renderer
git commit -m "feat(drafts): show a connector origin without pretending it came from a model"
```

---

### Task 5: The button

**Files:**
- Modify: `apps/desktop/src/renderer/src/features/workspace/queries.ts`
- Modify: `apps/desktop/src/renderer/src/features/workspace/screens/PluginsPanel.tsx`
- Modify: `apps/desktop/src/renderer/src/features/workspace/screens/PluginsScreen.tsx`
- Modify: `apps/desktop/src/renderer/src/features/workspace/screens/PluginsScreen.test.tsx` (or the panel test)
- Modify: `apps/desktop/src/renderer/src/features/workspace/WorkspaceShell.tsx`

**Interfaces:**
- Consumes: `fetchFromConnector` SDK method; `PluginsScreen({ root })`
- Produces: a `Fetch` control rendered only for enabled connectors

- [ ] **Step 1: Write the failing panel test**

Assert that an enabled connector row renders a Fetch control, a disabled one does
not, and a report-section plugin never does.

- [ ] **Step 2: Run; expect FAIL**

- [ ] **Step 3: Add the query and the control**

`useConnectorFetch()` — a mutation calling `client.fetchFromConnector`, invalidating
`["drafts"]` on success. Add `onFetch` to `PluginsPanel`, rendering the control only
when `manifest.kind === "connector" && plugin.enabled`. Wire a one-line query input.

Give `PluginsScreen` a `root` prop and pass it from the Stage
(`WorkspaceShell.tsx`, `case "Plugins": return <PluginsScreen root={root} />;`).

- [ ] **Step 4: Route the result into the Draft Desk**

The Draft Desk currently owns its queue in local `useState`, so a fetch made on the
Plugins screen cannot reach it. Lift the queue into a small shared hook
(`useDraftInbox`) in `queries.ts` holding `DraftRecord[]` plus `enqueue` and
`discard`, and have both screens use it. `DraftDeskScreen` keeps its behaviour;
the queue simply stops being component-local.

- [ ] **Step 5: Full gate, e2e, and commit**

```bash
pnpm -r test && pnpm lint && pnpm typecheck
pnpm --filter @open-merchant/desktop test:e2e
git add apps/desktop/src/renderer
git commit -m "feat(connectors): fetch from a connector into the Draft Desk"
```

---

### Task 6: Docs and full verification

- [ ] **Step 1: Update `ROADMAP.md`** — mark item 3 shipped, state plainly that
  unaccepted drafts (AI and connector alike) are session-scoped and lost on restart.
- [ ] **Step 2: Update `CHANGELOG.md`** under Unreleased → Added.
- [ ] **Step 3: Full gate plus e2e**, and confirm no third-party JS is imported:
  `grep -rn "import(" apps/desktop/src/main/connector-client.ts` → no matches.
- [ ] **Step 4: Commit.**

---

## Definition of done

All five spec §8 criteria met, gate green, and the five Review Focus inputs pinned
by tests in the task that owns the code.
