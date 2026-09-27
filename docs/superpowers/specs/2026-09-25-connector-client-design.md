# MCP Connector Client — Design Spec

**Date:** 2026-09-25
**Phase:** 3, item 3
**Status:** Approved (owner instructed autonomous execution; conversational review gates run in fast mode)
**Roadmap item:** `ROADMAP.md` Phase 3 §3 — "MCP connector client — opt-in market data through the draft gate"
**Depends on:** `docs/superpowers/specs/2026-09-25-plugin-surface-design.md` (shipped)

---

## 1. What already exists

| Artifact | Location | State |
| --- | --- | --- |
| `fetchFromConnector` | `apps/desktop/src/main/connector-client.ts` | shipped, 3 tests passing, **no production caller** |
| `connectorResultSchema` | `packages/shared/src/phase3.ts` | shipped |
| `connectorOriginSchema` | `packages/shared/src/provenance.ts:23` | shipped, **no runtime user** |
| `connectorFetched` run op | `packages/shared/src/provenance.ts:54` | shipped, **no runtime user** |
| `PluginStore` discovery | `apps/desktop/src/main/plugin-store.ts` | shipped by item 5 |
| `evidence/save`, `competitors/save` accept `GenerationOrigin` | `packages/shared/src/ipc.ts:140,154` | shipped — **already ready for a connector origin** |
| Draft Desk accept path | `DraftDeskScreen.tsx:195-250` | assigns ids, passes `origin` through — already ready |

The write path needs no change to accept connector output. The gap is entirely on the
way in: a surface to press, a channel to carry the request, a conversion to drafts,
and a Draft Desk that can show a provenance block with no AI in it.

## 2. The draft gate, unchanged

A connector fetch is a **button press**, never a poll, a crawl, or a background job.
Its output is a **draft**, never project data. It becomes project data only when a
human presses Accept, through the same `evidence/save` / `competitors/save` channels
every other write uses, carrying a `connectorOrigin` that the run journal records.

The deterministic core does not loosen. A connector's price is a string that enters
the same `moneyStringSchema` boundary as a hand-typed one; if the arithmetic later
touches it, it goes through `packages/core`'s decimal engine like everything else.

## 3. Locked decisions

### 3.1 The fetch control lives on the Plugins screen, beside the connector's source

The connector's command, args, and network disclosure are already rendered there.
A seller should not be able to fetch from a connector whose manifest they have not
opened, so the control sits in the same panel as the source it depends on.

`PluginsScreen` currently takes no `root` prop; it gains one, because a fetch is
scoped to the project the seller is looking at. The Stage already has `root`.

**Alternative rejected:** putting the fetch on the Competitors screen, next to the
data it produces. It reads more naturally, but splits the plugin's definition from
its one non-trivial action, and puts a network-touching button far from the
disclosure that says it may touch the network.

### 3.2 Draft persistence is out of scope; connector drafts are session-scoped

Unaccepted drafts live in React state and are lost on restart. That is already true
of all six AI drafts. A connector draft inherits exactly the same lifetime.

This is stated, not hidden: the Draft Desk's own empty state and this spec both say
so. Persistence is one fix for both, and it belongs in item 2's follow-up where the
existing gap is already tracked — not smuggled in here to make item 3 look more
complete than it is.

### 3.3 The fetch input is one free-text query

`pluginManifestSchema`'s connector variant declares no input schema, and
`fetchFromConnector` takes a free-form `input` object. The UI collects a single
line and sends `{ query }`.

**Known limitation, documented rather than designed away:** a connector needing
structured input has no way to declare it. Adding an input schema to the manifest is
the right fix and is deliberately deferred — nothing needs it yet, and inventing a
schema before a real connector asks for one is how contracts rot.

## 4. Trust model — what a connector can and cannot do

Restating the item-5 model, because a connector is the one kind that executes:

**Enforced by this app:**
- `capabilities.writes` must include `"drafts"`, or `fetchFromConnector` refuses
  loudly, naming the plugin (`connector-client.ts:51`).
- The response is parsed with `connectorResultSchema`; non-conforming output is
  refused, not coerced.
- 2 MB response cap, 30 s per call, child environment scrubbed to
  `PATH`/`SystemRoot`/`WINDIR`/`TEMP`/`TMP`.
- **The only thing this app will accept from a connector is a draft.** There is no
  path from a connector result to a write that bypasses Accept.

**Disclosed, not enforced:** `capabilities.network`. Node cannot stop a child process
opening a socket. The Plugins screen says "This plugin may reach the internet" and
must keep saying so; no copy may imply the app prevents it.

## 5. Runtime design

### 5.1 New IPC channel

```ts
"connectors/fetch": {
  request: z.object({
    root: z.string(),
    pluginId: z.string().min(1),
    query: z.string().min(1),
  }),
  response: z.object({
    drafts: z.array(draftRecordSchema).min(1),
    fetchedAt: isoDateTimeSchema,
  }),
},
```

Response drafts are `draftRecordSchema` entries with kind `evidence` or
`competitors` and `origin` a `connectorOrigin`. This is the existing shape from
item 5 — a draft's *kind* is its payload type, its *origin* is where it came from,
and the two are independent.

`draftRecordSchema` needs no change: `plan`/`evidence`/`competitors`/`economics`/
`sections`/`audit`/`currency` already covers it, and `generationOriginSchema`
already includes the connector variant.

### 5.2 Main handler

`apps/desktop/src/main/ipc.ts`:

```ts
"connectors/fetch": channel<"connectors/fetch">(async ({ root, pluginId, query }) =>
  service.fetchFromConnector(root, pluginId, query, plugins),
),
```

`MerchantService.fetchFromConnector`:

1. `plugins.list()`, find the plugin, require `enabled` and `kind === "connector"`.
2. Build the `connectorOrigin` — `{ kind: "connector", connectorId, pluginId, fetchedAt, rawResponseHash }`.
3. Call `fetchFromConnector(manifest, directory, { query })`.
4. Map `result.evidence` → one `draftRecordSchema` of kind `evidence`;
   `result.competitors` → one of kind `competitors`. Each gets a stable
   `DRAFT-<pluginId>-<n>` id so the queue can address and discard it.
5. Journal a `connectorFetched` run carrying the raw-response hash.
6. Return the drafts. **Nothing is written to the project.**

Failure returns a coded `AppError`; the seller's project is untouched either way.

### 5.3 Draft Desk must learn a connector origin

`DraftDeskScreen.tsx:33` declares its own `DraftRecord` union typed
`origin: AiOrigin`. Two changes:

- Widen `origin` to `GenerationOrigin`.
- Replace the single AI provenance block (`:378-387`, which reads
  `active.origin.agentId`) with a renderer that branches on `origin.kind`:
  - `ai` → today's four rows, unchanged.
  - `user` → a short "entered by you" row.
  - `connector` → connector id, plugin id, fetched at, and the raw-response hash
    (truncated for display, full value available). Labelled "Connector", not "AI".

The `aria-label="AI provenance"` must become something that is true for both, e.g.
`aria-label="Draft provenance"`.

The accept handlers already pass `origin: active.origin` into channels typed
`GenerationOrigin`, so accepting a connector draft needs no new write path.

## 6. Testing

`apps/desktop/tests/connector-fetch.test.ts` (new, service-level, real temp dirs):

- a fetch from an enabled connector produces evidence/competitor drafts
- every returned draft carries a `connectorOrigin` with the connector's id and a
  SHA-256 raw-response hash
- a `connectorFetched` run is journaled into **that project's** `runs.jsonl`
- **the project is otherwise untouched** — no evidence, no competitors, no
  provenance records written before Accept
- a disabled connector is refused
- a non-connector plugin id is refused
- a connector whose fetch throws leaves the project untouched

`DraftDeskScreen` provenance rendering: extract the origin block to a pure
component and test it with `renderToStaticMarkup`, as `PluginsPanel` does — an AI
origin renders the AI rows, a connector origin renders connector rows and no
"Prompt hash".

## 7. Out of scope

- **Draft persistence** — §3.2; belongs to item 2's tracked gap.
- **A manifest-declared input schema** — §3.3.
- **Enforcing `network: false`** — impossible from Node; §4.
- **Scheduling, polling, or background fetch** — the draft gate forbids it.
- **A sample connector implementation** — the done-when needs one fetch to work
  end to end, so this item ships a fixture connector used by the tests. Packaging a
  user-installable one is item 5's plugin story, already delivered.

## 8. Definition of done

1. An enabled connector can be fetched from the Plugins screen with an explicit
   button press, and only from there.
2. The result lands in the Draft Desk as evidence/competitor **drafts** carrying a
   connector origin, with provenance visible before Accept.
3. Accepting one writes it through the normal save channel and journals
   `connectorOrigin` as provenance; the `connectorFetched` run is in the project
   journal.
4. Before Accept, the project contains none of it.
5. `pnpm -r test && pnpm lint && pnpm typecheck` is green.
