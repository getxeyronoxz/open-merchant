# Currency change — design

Status: binding authority for Phase 3 item 6.
Date: 2026-09-26
Branch: `feature/phase-3-combined`

## The problem

A project's currency is fixed at creation. A seller who starts a project in
INR and then discovers their marketplace settles in EUR, or who simply
re-prices the whole study in their reporting currency, has no way to move
except rebuilding the project by hand.

ROADMAP item 6 asks for a deliberate, decimal-exact change:

> the user enters the conversion rate by hand (no network, no live FX), every
> stored monetary amount is converted in arbitrary-precision decimals, old and
> new values are journaled, and the change requires explicit confirmation via
> the inbox's diff UI because it touches every artifact in the folder.

## Non-negotiable constraints

- Commerce math runs only on arbitrary-precision decimals in `packages/core`.
  Never binary floating point, never an LLM. The rate is a decimal string that
  is parsed with `Decimal`, and every converted amount is rounded half-up to
  two places on emission — the same rule the money engine already applies.
- **No network, no live FX.** The rate is hand-entered. The app never looks up
  a rate, never offers to, and the schema has nowhere to put one.
- Project files are canonical. Malformed data is rejected loudly; a change is
  never partially applied and never silently recovered.
- The renderer never imports Electron. The renderer also never computes the
  conversion — it asks for a preview and shows it.

## What "the rate" means

`rate` is the multiplier applied to stored amounts to obtain the new currency:
`new = round(old × rate)`. The seller enters it as "1 INR = 0.011 EUR" and the
UI labels the input that way. The direction is part of the contract; a rate is
never inferred from the two currency codes.

A rate of zero is refused, and so is a `toCurrency` equal to the current
currency. Converting a project to itself at rate 1 changes no bytes and would
journal a claim that something happened.

## Which numbers move, and which do not

This is the part that must be right, because a percentage that gets converted
is a silent corruption that no validator will ever catch.

**Converted** (amounts of money):

| Artifact | Fields |
| --- | --- |
| `manifest.json` | `currency` only — a code, not an amount |
| `economics/assumptions.json` | `acquisitionCost`, `shippingCost`, `otherCosts`, `scenarioPrices.{low,base,high}` (null stays null), `currency` |
| `economics/scenarios.json` | `sellingPrice`, `acquisitionCost`, `shippingCost`, `marketplaceFee`, `paymentFee`, `otherCosts`, `totalCost`, `grossProfit` |
| `market/competitors.json` | `price` (null stays null), `currency` |
| `market/snapshots/*.json` | every listing's `price` and `currency`; `statistics` recomputed (below) |

**Never converted** (ratios and percentages, which are dimensionless):

- `assumptions.marketplaceFeeRate`, `assumptions.paymentFeeRate` (0–100)
- `assumptions.marginThresholdPercent` (0–100)
- every scenario's `marketplaceFeeRate` and `paymentFeeRate`
- every scenario's `grossMarginPercent`

A margin of 40.45% is 40.45% in every currency. Multiplying it by a rate is the
kind of bug that looks plausible and is invisible until someone reads the
report.

## Market snapshots

A snapshot is described in the schema as "immutable, timestamped". This design
converts it anyway, and the tension is worth stating plainly rather than
hiding:

- **Why.** The margin monitor compares a scenario's selling price against the
  latest snapshot's median. Price history and snapshot diffs are derived from
  the snapshot sequence. If the project's competitors were restated in EUR and
  the snapshots were not, every one of those comparisons would silently become
  a comparison between two currencies — a breach of 9990% at best. Leaving
  snapshots behind is not "preserving history", it is breaking the project.
- **What it costs.** A snapshot recorded what a listing cost on a past date.
  After a change, that file records the restatement of that observation at the
  hand-entered rate, not the observation. The seller is asking for exactly
  that — "restate my whole project in this currency" — but the confirmation UI
  must say it in words, and each change is journaled with its rate, so the
  sequence of restatements is reconstructable.
- **Ids are safe.** A snapshot id is `SNAP-<timestamp>-<random>`, not a content
  hash, so rewriting a snapshot's bytes does not invalidate its id or the
  price-history keys derived from it.

**Statistics are recomputed, not converted.** After converting the listings, a
snapshot's `statistics` is re-derived with `competitorStatistics` rather than
having the stored mean multiplied by the rate. The stored statistic describes
the prices as stored; once the prices have been rounded individually to two
places, the mean of those rounded prices is the only value the file can
truthfully claim. Converting the mean directly would leave the file
contradicting its own listings.

## Rate precision and rounding

`conversionRateSchema` admits up to twelve fractional digits — a rate carries
more precision than an amount, because an amount is rounded on emission. The
product is computed at full decimal precision and rounded once, half away from
zero, to two places, by the existing `roundAmount`. Every emitted amount is
canonical two-place form.

## Plan, preview, apply

The whole change is a **plan** computed in core: for each affected artifact,
its exact `before` and `after` file contents, plus flat maps of every money
value that changed and its old and new string.

- `beforeHash` / `afterHash` are SHA-256 over the concatenation of
  `path\0sha256(contents)\n` for every affected artifact, sorted by path. They
  describe the *set* of artifacts, not one file, because a currency change is
  not a change to any single file.
- The preview carries those two hashes, the affected artifact fingerprints, and
  the old/new value maps, so the UI can show a real diff rather than a claim
  that something would change.

Two IPC calls, both taking only the seller's intent (`root`, `toCurrency`,
`rate`):

- `currency/preview` — computes the plan and returns it. **Writes nothing.**
- `currency/apply` — recomputes the plan, writes it, verifies, journals.

Apply never trusts a plan the renderer built, and never trusts a plan that was
cached from the preview. A seller who edits a competitor price between preview
and confirm gets the current price converted, and the journal records the
before-value that was actually on disk.

## Writing it safely

`WorkspaceStore` caches its manifest and validates competitors and assumptions
against that cached currency. Writing the manifest first would therefore make
every subsequent store save fail by design, and the store's own savers cannot
be used mid-change at all. So the change is applied by writing artifact
contents directly, after validating each converted document against its shared
schema — the same schemas the store validates with.

The order is: every artifact except the manifest, then the manifest last. Any
failure restores the artifacts already written from their captured `before`
bytes and journals a **failed** `currencyChanged` run. After the writes, the
affected artifacts are re-read and re-hashed; if the combined hash is not the
plan's `afterHash`, that is also a failure and is rolled back. A journal
record is only appended once the bytes on disk are known to be what the record
says they are — the same rule the standing-review disposition follows.

A hard process kill between two writes can still leave a mixed state. That is
detectable, not silent: the project's own validators reject competitors or
assumptions whose currency does not match the manifest, so the next read fails
loudly rather than showing wrong numbers. This is a deliberate limit, not an
oversight.

## The run record

`RunRecord` has no free-form payload bag and `inputArtifacts` means "a real file
was read", so the record cannot be smuggled into it. `currencyChange` becomes a
typed optional field on the run record, required exactly on `currencyChanged`
and forbidden on every other operation — the same shape as the review
disposition, and for the same reason.

The record carries: `runId`, `fromCurrency`, `toCurrency`, `rate`, `changedAt`,
the affected artifact fingerprints, `beforeHash`, `afterHash`, and the full
`oldValues` / `newValues` maps. Every value that moved is recoverable from the
journal, which is what makes this reversible and auditable rather than a
destructive rewrite.

The currency schemas move from `phase3.ts` into `provenance.ts`, beside the run
record they are written into. `phase3.ts` already imports `provenance.ts`, so
the reverse import would be a module-initialisation cycle, and zod schemas are
built at module evaluation. `phase3.ts` re-exports them, exactly as it does for
the review schemas.

## Where it lives in the UI

On the Economics screen, below the margin monitor: a "Change currency" action
that opens a panel with the new currency and the hand-entered rate, a
"Preview change" button, and then — only once a preview exists for the values
currently in the form — a confirm button.

The preview is a diff: how many values change, the first twenty of them as
before → after rows, the artifacts affected, and a plain sentence about what
happens to market snapshots. The confirm button is disabled while the inputs
differ from the preview that is on screen, so the seller can never confirm a
change they have not been shown.

A preview that changes no amounts is not an error: a project with no priced
competitors still changes its currency code. The UI says "no amounts to
convert" rather than pretending something will happen.

## Review focus

1. No percentage is ever converted. A fee rate or a margin multiplied by an FX
   rate is the failure this design exists to prevent.
2. A change writes either every affected artifact or none, and the journal
   records the bytes that are actually on disk.
3. The renderer never performs the conversion and never supplies a plan.
4. Statistics are recomputed from converted listings, so a snapshot never
   contradicts itself.
5. A refused change — same currency, zero rate, malformed document — writes
   nothing and leaves the project readable.
