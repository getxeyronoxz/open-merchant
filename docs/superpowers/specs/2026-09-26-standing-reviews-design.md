# Standing reviews — design spec

Date: 2026-09-26
Status: binding authority for `docs/superpowers/plans/2026-09-26-standing-reviews.md`
Roadmap item: Phase 3 #4 — "Standing reviews — the app remembers."

## Problem

The core already computes every signal a standing review needs, and none of it
reaches the seller:

- `decisionJournal()` in `packages/core/src/decision-journal.ts` flags evidence
  older than `STALE_AFTER_DAYS` (30) — but only inside the per-project journal
  view, which a seller has to open one project at a time.
- `marginMonitor()` in `packages/core/src/monitor.ts` produces `watch` and
  `breached` flags — surfaced as a badge on the portfolio row, with no
  explanation of *which* scenario, *since when*, or *what to do*.
- Nothing at all tracks a project that has evidence, competitors, and economics
  but has never produced a report. That is the most expensive kind of unfinished
  work and the app is silent about it.

The portfolio answers "which project is worst?" but not "what needs attention
this week?", and a seller who dismisses a nagging signal has no way to say
"stop telling me about this for a week".

## Done-when (from the roadmap, verbatim)

> the portfolio answers "what needs attention this week?" and snoozing is on
> the record.

Both halves are testable: a queue of dated reviews across all projects, and a
snooze whose disappearance is recorded in the project.

## Review kinds and severity

| kind | condition | severity |
| --- | --- | --- |
| `unchecked-decision` | project has economics assumptions or scenarios, and no successful `reportGenerated` run | `warning` after 7 days, `info` before |
| `stale-evidence` | an evidence source whose `observedAt` is older than `STALE_AFTER_DAYS` | `warning` |
| `margin-watch` | a scenario flag at `watch` | `warning` |
| `margin-breach` | a scenario flag at `breached` | `critical` |

`dueAt` is the moment the review became due: for stale evidence the
`observedAt + STALE_AFTER_DAYS`, for margin flags the run time of the snapshot
that produced them (falling back to now when the snapshot is absent), and for an
unchecked decision the first moment any economics artifact was written.

## Decisions

### D1 — The computation lives in `packages/core`, and `now` is injected

New module `packages/core/src/standing-reviews.ts` exporting a pure
`standingReviews(input)` where `input` carries the per-project artifacts and an
explicit `now: Date`. This matches `decisionJournal(runs, evidence, now)`, which
already documents itself as "Deterministic for a given `now` — no hidden clocks".
A review queue whose contents depend on an invisible clock is not testable, and
`portfolioOverview` already reads `Date.now()` directly — this module does not
repeat that.

### D2 — Dispositions are derived from `runs.jsonl`, not a new artifact

`reviewSnoozed` and `reviewDismissed` run operations already exist in
`packages/shared/src/provenance.ts`. The journal is already the project's
append-only record of everything meaningful that happened to it, and the roadmap
requires snoozing to be *on the record*. Storing dispositions in a new
`.openmerchant/reviews.json` would mean two sources of truth for the same fact
and would expand the workspace format before the interchange spec (item 7)
publishes it as a compatibility promise.

So: snoozing appends a run record; `deriveDispositions(runs)` reads them back.
The derived value is validated through the existing `reviewDispositionsSchema`,
so the contract still governs what a disposition may look like.

The corollary is a feature, not a wart: **a dismissal expires when its
condition stops being generated.** If the evidence is refreshed and goes stale
again years later, the old dismissal is gone with the review it silenced, and
the new one is correctly treated as new. A separate artifact could never do this
without an explicit garbage-collection pass.

### D3 — Review keys are scoped to their project and carry no project name

`reviewKey` is `<kind>:<subject>`, e.g. `stale-evidence:S-001`,
`margin-watch:base`, `unchecked-decision:decision`.

Because dispositions live in the project's own journal (D2), the project is
already the scope — a key only has to be unique *within* one project. Folding
the project name or path into the key would be redundant, and worse, it would
make a snooze silently evaporate when the seller renames or moves the project
folder, which is a supported operation for a portable workspace.

Subject values (`S-001`, `base`, `decision`) already satisfy the contract's
`[A-Za-z0-9_-]+` segment rule.

### D4 — The `reviewKey` regex must admit a dashed kind

The contract is currently `/^[a-z0-9]+:[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)?$/u`.
The first segment forbids `-`, so none of the four kinds — `unchecked-decision`,
`stale-evidence`, `margin-watch`, `margin-breach` — can be used verbatim. The
alternative is a second, dashless vocabulary (`staleevidence`) that exists only
to satisfy a regex, which is exactly the kind of indirection that later gets
mismatched.

The first segment becomes `^[a-z][a-z0-9-]*`. It still admits no `:`, no `/`, no
`\`, and no uppercase, so a key remains incapable of expressing a path. This
contract was introduced in this same phase and has never shipped, so amending it
now costs nothing and is far cheaper than amending it after item 7 publishes the
format.

### D5 — Snooze is one week; dismissal is until the condition changes

`snoozed` sets `until = now + 7 days`. Seven days is the unit the roadmap's
done-when asks about ("this week") and is long enough to matter, short enough
that a forgotten snooze cannot hide a real breach indefinitely.

`dismissed` sets `until = null`, meaning "not until the condition changes" —
which D2 makes true automatically. A suppressed review is any review whose key
has a live disposition: a snooze whose `until` is still in the future, or a
dismissal.

## Shape of the change

Five hops, as every feature in this app:

1. `packages/shared/src/phase3.ts` — amend `reviewKey` (D4). `standingReviewSchema`
   and `reviewDispositionsSchema` are otherwise already correct and unused.
2. `packages/core/src/standing-reviews.ts` — `deriveDispositions(runs)` and
   `standingReviews(input)`, both pure, both node-only, both unit-tested without
   React or Electron.
3. `packages/shared/src/ipc.ts` + `packages/sdk/src/client.ts` + `mock.ts` —
   `reviews/standing` (query) and `reviews/dispose` (mutation), zod-validated in
   both directions.
4. `apps/desktop/src/main/service.ts` + `ipc.ts` — `standingReviews(recents)`
   fans out across projects the way `portfolioOverview` does; `disposeReview`
   opens exactly one project and appends one run.
5. `apps/desktop/src/renderer/src/features/home/` — an attention card on the
   Home screen above the portfolio, with a Snooze and a Dismiss per row.

## Review focus

1. **A snooze must actually suppress, and must be visible as having happened.**
   The disposition is only worth writing if reading it changes what the queue
   shows. Both directions need tests: snoozed-then-hidden, and the run record
   that proves it.
2. **A disposition must never cross project boundaries.** `disposeReview` opens
   one project by root; the journal it appends to is that project's.
3. **An unopenable project must not break the queue.** `portfolioOverview`
   already swallows per-project failures and returns a flagged row; the
   attention queue does the same and simply omits a project it cannot read.
4. **Nothing here contacts a network.** Standing reviews are timers over local
   artifacts. There is no server, no push, no polling.
5. **A review is derived, never stored.** There is no artifact to drift out of
   sync with the evidence, because there is no artifact.
