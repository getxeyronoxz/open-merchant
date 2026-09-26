# Plan — standing reviews (Phase 3 item 4)

Spec: `docs/superpowers/specs/2026-09-26-standing-reviews-design.md` (binding authority)
Branch: `feature/phase-3-combined`
Ledger: `.superpowers/sdd/2026-09-26-standing-reviews/progress.md`

Roadmap done-when: *the portfolio answers "what needs attention this week?" and
snoozing is on the record.*

## Pre-flight shared-interface scan

| Producer | Consumer | Contract | Status |
| --- | --- | --- | --- |
| T2 | T4 | `StandingReview`, `ReviewDisposition` | exists in `phase3.ts`, unused |
| T4 | T5 | channels `reviews/standing`, `reviews/dispose` | new |
| T5 | T6 | `StandingReview[]` | new to the renderer |
| T1 | T2 | `reviewKey` regex | **amended** (D4) — none of the four kinds match it today |

No conflicts. T1 must land before T2, because the key shape is what T2 emits.

## Tasks

### T1 — Amend the `reviewKey` contract
`packages/shared/src/phase3.ts`: first segment `^[a-z0-9]+` → `^[a-z][a-z0-9-]*`.
Test in `packages/shared/tests`: each of the four kinds parses as a key; a key
containing `/`, `\`, or a leading uppercase in segment one is refused.

### T2 — `deriveDispositions` + `standingReviews` in core
New `packages/core/src/standing-reviews.ts`, node-only, no React/DOM.
- `deriveDispositions(runs)` — pull `reviewSnoozed` / `reviewDismissed` runs out
  of a run list, keep the newest per `reviewKey`, validate through
  `reviewDispositionsSchema`.
- `standingReviews(input)` — per project, emit the four kinds; drop any whose
  key has a live disposition; sort by severity (`critical`, `warning`, `info`),
  then `dueAt` ascending, then project name.

Tests in `packages/core/tests/standing-reviews.test.ts`: each kind fires; a
healthy project emits nothing; a snoozed review is suppressed; a snooze that has
expired is *not* suppressed; a dismissal suppresses; a dismissal whose condition
cleared is dropped and does not suppress the same condition returning later;
malformed run records are rejected, not silently coerced.

### T3 — Store access to the journal
`deriveDispositions` needs runs, which `WorkspaceStore` already exposes via
`store.journal.listRuns()`. No new store method unless T2's tests force one.

### T4 — IPC contract + SDK
`packages/shared/src/ipc.ts`: `reviews/standing` (request `{ roots }`, response
`standingReviewsSchema`) and `reviews/dispose` (request `{ root, reviewKey,
action }`, response `{ reviewKey, action, until }`).
`packages/sdk`: `standingReviews(roots)` and `disposeReview(root, key, action)`
on the interface, the real client, and the mock.
`packages/sdk/tests/browser-safe.test.ts` must stay green — no node builtins.

### T5 — Main-process service + handlers
`service.standingReviews(recents)` — fan out like `portfolioOverview`, skip a
project it cannot open. `service.disposeReview(root, reviewKey, action)` — open
one project, append one `reviewSnoozed` / `reviewDismissed` run.
`apps/desktop/tests/standing-reviews.test.ts`:
- the queue spans every project and is sorted worst-first;
- a project that cannot be opened is omitted, not fatal;
- `disposeReview` appends exactly one run of the right operation with the right
  `reviewKey`, and changes nothing else in the project;
- snoozing for 7 days suppresses that review on the next read;
- an unknown or unsafe `reviewKey` is refused before any write.

### T6 — Attention card on the Home screen
New `StandingReviewsCard` in `features/home/`, rendered above the portfolio on
HomeScreen. Each row: severity badge, title, detail, project name, due date, and
Snooze / Dismiss buttons. Empty state names what the queue watches for.
Tests beside the component under `src/renderer/src/...` using
`renderToStaticMarkup`, per the repo's existing pattern.

### T7 — Docs and gate
`ROADMAP.md` item 4 marked shipped with the guarantee set; `CHANGELOG.md` Unreleased.
Then `pnpm -r test && pnpm lint && pnpm typecheck` and
`pnpm --filter @open-merchant/desktop test:e2e`.

## Order and dependencies

T1 → T2 → T3 → T4 → T5 → T6 → T7. T2 and T3 may commit together if T3 turns out
to add nothing; T4 and T5 likewise, because `Record<IpcChannel, AnyHandler>`
cannot typecheck until the handler exists (the same coupling recorded as R1 in
the connector plan).

## Out of scope

- Persisting the queue itself. It is derived, always (D2/D5).
- Any network, push, or polling. Standing reviews are local timers.
- Item 6 (currency change) and the UI/UX pass — separate plans on this branch.
