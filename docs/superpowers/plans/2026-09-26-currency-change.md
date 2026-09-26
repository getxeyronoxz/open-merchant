# Plan — currency change (Phase 3 item 6)

Spec: `docs/superpowers/specs/2026-09-26-currency-change-design.md` (binding authority).
Branch: `feature/phase-3-combined`.

One test at a time. A test that fails because a symbol is missing is not a
RED — point it at the schema that already exists so the failure is about the
rule, not the import.

## Pre-flight shared-interface scan

| Producer | Consumer | Contract | Finding |
| --- | --- | --- | --- |
| T1 | T2 | `CurrencyChangePreview`, `CurrencyChangeRecord` | move to `provenance.ts`, amend preview |
| T1 | T4 | `runRecordSchema.currencyChange` | new optional field, required on one operation |
| T2 | T4 | `planCurrencyChange`, `CurrencyChangePlan` | new |
| T2 | T4 | `writeCurrencyPlan` | new |
| T4 | T5 | channels `currency/preview`, `currency/apply` | new |
| T5 | — | `CurrencyChangePanel` | renderer only |

`phase3.ts` imports `provenance.ts`, so the currency schemas move into
`provenance.ts` and are re-exported. The cycle is real: zod schemas are built
at module evaluation, and `provenance.ts` needs `currencyChangeRecordSchema` to
type the run payload.

## Ordering

T1 → T2 → T3 → T4 → T5 → T6 → T7

---

## T1 — shared: the schemas and the run payload

1. Failing test: `packages/shared/tests/currency-change-record.test.ts`
   - a `currencyChanged` run is rejected without its `currencyChange`
   - a run with `currencyChange` is rejected on any other operation
   - the record's `oldValues` / `newValues` round-trip
   - the preview carries the value maps and a change count (amended shape)
   - a rate of `0`, `0.00`, or `0.000000000000` is rejected
2. Move `conversionRateSchema`, `currencyChangePreviewSchema`,
   `currencyChangeRecordSchema` from `phase3.ts` to `provenance.ts`; re-export
   from `phase3.ts`; tighten the rate to a positive decimal.
3. Amend the preview: drop the single `sample` row, add `oldValues`,
   `newValues`, `changedCount`.
4. Add `currencyChange: currencyChangeRecordSchema.optional()` to
   `runRecordSchema`, and extend the superRefine so it is required on
   `currencyChanged` and forbidden everywhere else.

## T2 — core: the plan and the write

1. Failing test: `packages/core/tests/currency-change.test.ts`
   - converts amounts, leaves fee rates and margins alone
   - nulls stay null; the currency code moves on every artifact
   - snapshot statistics are recomputed from converted listings
   - refuses a zero rate and a same-currency change
   - before/after hashes describe the artifact set and are stable
   - the preview's value maps are exactly the values that moved
2. `packages/core/src/currency-change.ts`
   - `planCurrencyChange(input): CurrencyChangePlan` — pure
   - `writeCurrencyPlan(root, plan): Promise<ArtifactFingerprint[]>` — writes,
     re-reads, verifies the combined hash, rolls back on any failure
3. Export from `packages/core/src/index.ts`.

## T3 — sdk

1. Failing test: `packages/sdk/tests/client.test.ts` additions
2. `currencyPreview(root, toCurrency, rate)` and `applyCurrencyChange(...)` on
   the client interface and implementation.
3. Mock implementations. The mock cannot import core (node-only, and every
   runtime file in `packages/sdk/src` reaches the browser bundle), so it reports
   the artifacts it would touch and no amount changes rather than inventing
   numbers with a float.

## T4 — desktop service and IPC

1. Failing test: `apps/desktop/tests/currency-change.test.ts`
   - preview writes nothing to the folder
   - apply converts every artifact on disk and appends exactly one run
   - the journal's old/new values match the bytes that were replaced
   - a refused change appends a failed run and changes no bytes
2. `MerchantService.currencyPreview` / `applyCurrencyChange`; the record's
   `runId` is the run it is written into.
3. Register both channels in `apps/desktop/src/main/ipc.ts`.

## T5 — renderer

1. Failing test: `CurrencyChangePanel.test.tsx`
2. `useCurrencyPreview` / `useApplyCurrencyChange` in `queries.ts`.
3. The panel: currency + rate inputs, preview diff, confirm disabled until the
   inputs match the preview on screen. A plain sentence about snapshots.
4. Add `.om-diff` (before/after rows) to `packages/ui/src/components.css`.
5. Mount it on `EconomicsScreen` below the margin monitor.

## T6 — docs

`ROADMAP.md` item 6 → shipped. `CHANGELOG.md` Unreleased → Added.
`docs/architecture.md` — the artifact list gains the currency change.

## T7 — full gate

`pnpm -r test && pnpm lint && pnpm typecheck`, then
`pnpm --filter @open-merchant/desktop test:e2e`.
