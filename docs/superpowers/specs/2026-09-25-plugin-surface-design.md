# Plugin Surface — Design Spec

**Date:** 2026-09-25
**Phase:** 3, item 5
**Status:** Approved (owner instructed autonomous execution; conversational review gates run in fast mode)
**Roadmap item:** `ROADMAP.md` Phase 3 §5 — "Plugin surface — local, inspectable, capability-declared"

---

## 1. Why this comes first

`ROADMAP.md` lists item 3 (MCP connector client) before item 5 (plugin surface). That
order is unshippable. The connector client is written *as a plugin kind*:

```ts
// apps/desktop/src/main/connector-client.ts:46
manifest: Extract<PluginManifest, { kind: "connector" }>,
```

`PluginManifest` is defined in the item-5 contract file. The client cannot fetch
anything until a plugin manifest exists to describe the connector, and until a
folder convention exists to discover it in. **Item 5 is a hard prerequisite for
item 3.** This spec therefore lands item 5 first; the connector's own UI wiring
follows in the item-3 plan.

## 2. What already exists (uncommitted, in the working tree)

The contract layer is written and needs no redesign:

| Artifact | Location | State |
| --- | --- | --- |
| `pluginCapabilitySchema` | `packages/shared/src/phase3.ts:72-76` | uncommitted |
| `pluginManifestSchema` (3 kinds) | `packages/shared/src/phase3.ts:88-110` | uncommitted |
| `installedPluginSchema`, `pluginCatalogSchema` | `packages/shared/src/phase3.ts:112-118` | uncommitted |
| `runOperationSchema` `pluginEnabled` / `pluginDisabled` | `packages/shared/src/provenance.ts:58-59` | uncommitted |
| `connectorOriginSchema` | `packages/shared/src/provenance.ts:23-29` | uncommitted |
| Connector client + 3 passing tests | `apps/desktop/src/main/connector-client.ts` | uncommitted |

**Zero** runtime consumers exist for any of it. This spec builds the runtime
around the existing contracts rather than replacing them.

## 3. Locked decisions

Two decisions were made with the owner; both are load-bearing.

### 3.1 Plugins live in app data, never in a project folder

```
<userData>/plugins/<plugin-id>/manifest.json
```

One shared library, enabled from Settings, applying to every project. Rationale:
every plugin kind is a *tool or template* (a connector process, a supplier's CSV
dialect, a report boilerplate block), not project data. A seller with five
projects reuses the same supplier dialect five times; a project-scoped folder
would duplicate it five times and would put third-party config inside a folder
the owner may share or archive.

`CLAUDE.md` states "the user-owned project folder is the product." Nothing in
this design writes to a project folder at plugin-load time, so that principle
is untouched.

### 3.2 Report sections are static markdown — no templating

A `report-section` plugin ships literal markdown appended to one of the four
`reportSectionsSchema` fields. No `{{placeholder}}` resolver is built.

This matches the schema exactly as written (`markdown: z.string().trim().min(1)`,
`packages/shared/src/phase3.ts:108`) and keeps the capability model airtight: a
report-section plugin provably cannot reach any project data, so it needs no
`reads` capability and grants no read surface at all. A placeholder resolver
would be a new injection surface requiring its own allowlist and its own tests;
it is deferred until a real third-party report section demonstrates the need.

## 4. Trust model — stated precisely

`phase3.ts:71` already asserts the governing rule: *"No third-party JavaScript
is imported into Electron."* This spec makes that rule load-bearing.

| Kind | Payload | Executes code | Reaches project data |
| --- | --- | --- | --- |
| `report-section` | static markdown | no | no |
| `csv-importer` | column mapping | no | no |
| `connector` | external MCP stdio process | **yes** | via drafts only |

### 4.1 What is genuinely enforced

- `connector-client.ts:51` refuses a connector whose `capabilities.writes` omits
  `"drafts"`. Already written and tested.
- Every connector response is parsed with `connectorResultSchema`
  (`connector-client.ts:92`). Non-conforming output is refused, not coerced.
- Response capped at 2 MB, calls capped at 30 s, child environment scrubbed to
  `PATH`/`SystemRoot`/`WINDIR`/`TEMP`/`TMP` (`connector-client.ts:56-69`).
- A connector produces **drafts only**. It cannot write an artifact; the human
  accept path in the Draft Desk is the sole writer, and it journals
  `connectorOriginSchema` as provenance.

### 4.2 What is a disclosed contract, NOT a technical control

`capabilities.network` is a **promise the user approves at enable time**. Node
cannot prevent a spawned child process from opening a socket; there is no
sandbox around a spawned process's syscalls.

The UI must therefore present `network: true` as a risk the user is accepting,
not as a restriction the app is applying. This spec deliberately does not claim
sandboxing. Stating otherwise would repeat the Phase 2 print claim — promising
"exactly as it appears on screen" for a path that cannot deliver it.

### 4.3 Refusal behaviour

- A manifest failing `pluginManifestSchema` is listed as **broken with its
  reason**, never silently skipped. Consistent with `snapshots.ts` and
  `listMarketSnapshots` behaviour.
- A plugin whose directory basename ≠ `manifest.id` is refused (prevents a
  manifest claiming an id that shadows another folder).
- A manifest with no `author` is refused. `author` is `z.string().trim().min(1)`
  in the schema; §6 adds the test that proves it.

## 5. Runtime design

### 5.1 `PluginStore` — `apps/desktop/src/main/plugin-store.ts` (new)

Mirrors the existing `RecentsStore` / `AiConfigStore` constructor pattern
(`apps/desktop/src/main/recents.ts:23-24`, `ai-config.ts:78-81`).

```ts
export interface BrokenPlugin {
  readonly directoryName: string;
  readonly reason: string;
}

export class PluginStore {
  constructor(userDataDirectory: string);
  private get directory(): string;   // join(userDataDirectory, "plugins")
  private get statePath(): string;   // join(userDataDirectory, "plugin-state.json")

  list(): Promise<{ plugins: InstalledPlugin[]; broken: BrokenPlugin[] }>;
  readSource(pluginId: string): Promise<string>;
  setEnabled(pluginId: string, enabled: boolean): Promise<InstalledPlugin>;
}
```

- `list()` reads `<userData>/plugins/*/manifest.json`, parses each with
  `pluginManifestSchema`, and merges enabled state from `plugin-state.json`.
- `readSource()` returns the human-inspectable payload for the "source is one
  click away" rule: the `markdown` for a report-section, formatted JSON for a
  csv-importer `mapping`, and `command` + `args` for a connector.
- `setEnabled()` writes `plugin-state.json` and returns the updated record. The
  caller (IPC layer) journals `pluginEnabled` / `pluginDisabled`.

State file shape, mirroring `recent-projects.json`'s plain-JSON convention:

```json
{ "plugins": { "<plugin-id>": { "enabled": true, "enabledAt": "2026-09-25T00:00:00.000Z" } } }
```

Plugin ids are constrained by `^[a-z0-9]+(?:-[a-z0-9]+)*$`
(`phase3.ts:79`), so no id can traverse out of the plugins directory. The
directory-basename check in §4.3 is defence in depth, matching the
known-layout path-guard culture in `packages/core/src/layout.ts`.

### 5.2 IPC contract — `packages/shared/src/ipc.ts`

Three channels, matching the existing `z.object({...})` request/response shape:

```ts
"plugins/list": {
  request: z.object({}),
  response: z.object({ plugins: z.array(installedPluginSchema), broken: z.array(brokenPluginSchema) }),
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

`brokenPluginSchema` is added to `phase3.ts` rather than widening
`installedPluginSchema` with a nullable error field, so the valid-plugin shape
stays strict.

Wiring mirrors the established five hops: `packages/shared/src/ipc.ts` →
`packages/sdk/src/client.ts` (interface + impl) → `apps/desktop/src/main/ipc.ts`
handler → `PluginStore` → renderer.

### 5.3 UI — `PluginsScreen.tsx` (new)

Registered in `assistantSections` (`WorkspaceShell.tsx:31-34`) as
`{ name: "Plugins", label: "Plugins" }`. The rail and the Alt+digit shortcuts
derive from that array, so both extend to nine automatically
(`WorkspaceShell.tsx:91-93`); the README and CHANGELOG shortcut copy must be
updated from "Alt+1…8" to "Alt+1…9".

Screen contents:

1. **Installed list** — id, name, version, author, kind, and an enable toggle.
2. **Broken list** — directory name and the parse failure reason.
3. **Source panel** — opening a plugin shows `readSource()` output before the
   enable control is usable. A `network: true` connector shows an explicit
   "this plugin may reach the internet" line per §4.2.
4. **Empty state** — "No plugins installed. Add a folder under
   `<userData>/plugins`." using the shared `EmptyState` component, per the
   Phase 2 empty-state convention.

## 6. Testing

Unit (`apps/desktop/tests/plugin-store.test.ts`):

- valid manifest of each of the three kinds is discovered
- malformed manifest is refused and reported in `broken`, not silently dropped
- **manifest without `author` is refused** — the gap named in the audit
- directory basename ≠ `manifest.id` is refused
- plugins load `enabled: false` by default
- `setEnabled(true)` persists and survives a new `PluginStore` instance
- `readSource()` returns markdown / mapping / command+args per kind
- unknown `pluginId` throws

Integration (`apps/desktop/tests/service.integration.test.ts` additions):

- `plugins/set-enabled` journals a `pluginEnabled` run; disabling journals
  `pluginDisabled`

**Every Phase 2 feature currently has zero coverage of its IPC round-trip.**
This item does not repeat that: the two tests above drive the real channel.

## 7. Out of scope

Deferred deliberately, with reasons:

- **Placeholder templating in report sections** — §3.2.
- **Enforcing `network: false`** — impossible from Node; §4.2. Documented as a
  contract, not a control.
- **A marketplace or auto-update** — forbidden by `CLAUDE.md` ground rules.
- **Plugin-supplied code in any form** — the governing constraint, §4.
- **Item 3's connector UI, Draft Desk wiring, draft persistence** — separate
  plans.
- **A sandboxed JS plugin host** — would contradict §4 and the ground rules.

## 8. Definition of done

1. A third-party `report-section` plugin is discovered, its source is viewable,
   it is enabled with a journaled `pluginEnabled` run, and its markdown appears
   in the generated report.
2. A third-party `csv-importer` plugin supplies a column-mapping preset the user
   can select instead of mapping by hand.
3. A `connector` plugin is discovered and enabled; fetching through it produces
   inbox drafts (the item-3 follow-on wires the button).
4. A manifest missing `author` is refused, with the reason shown.
5. `pnpm -r test && pnpm lint && pnpm typecheck` is green.

Criterion 5 currently fails: `packages/shared/src/phase3.ts` has two unused
imports (`costAssumptionsSchema`, `economicsScenarioSchema`) that were reserved
for a currency-conversion helper. Task 1 resolves them.
