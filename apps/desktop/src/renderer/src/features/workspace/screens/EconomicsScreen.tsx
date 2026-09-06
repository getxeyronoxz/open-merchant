import { useEffect, useState } from "react";

import type { CostAssumptions, EconomicsScenario } from "@open-merchant/shared";
import { EmptyState, ErrorState, Field, LedgerRow } from "@open-merchant/ui";

import { useProject } from "../../../state/project";
import {
  useAssumptions,
  useCalculateScenarios,
  useMarginMonitor,
  useReviewEconomics,
  useSaveAssumptions,
  useScenarios,
} from "../queries";
import type { SectionName } from "../useWorkflowProgress";

/**
 * Unit economics: cost assumptions and low/base/high price scenarios.
 * All math happens in the deterministic core — the UI only edits inputs.
 */
export function EconomicsScreen({
  root,
  onNavigate,
}: {
  root: string;
  onNavigate?: (section: SectionName) => void;
}) {
  const assumptionsQuery = useAssumptions(root);
  const scenariosQuery = useScenarios(root);
  const calculate = useCalculateScenarios(root);

  if (assumptionsQuery.isPending) {
    return (
      <p className="om-loading">
        <span className="om-spinner" /> Loading assumptions…
      </p>
    );
  }
  if (assumptionsQuery.isError) {
    return <ErrorState error={assumptionsQuery.error} onRetry={() => assumptionsQuery.refetch()} />;
  }

  const scenarios = scenariosQuery.data?.scenarios ?? [];

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="om-eyebrow">Economics</p>
        <h1 className="om-section-title">What do the numbers say?</h1>
        <p className="om-section-sub">
          Fixed-decimal calculations in tested code — never floating point, never a language
          model.
        </p>
      </header>

      <div className="screen__columns">
        <AssumptionsForm root={root} initial={assumptionsQuery.data.assumptions} />
        <ScenarioPanel
          root={root}
          calculateError={calculate.error}
          calculating={calculate.isPending}
          onCalculate={() => calculate.mutate()}
          scenarios={scenarios}
          scenariosPending={scenariosQuery.isPending}
          scenariosQuery={scenariosQuery}
        />
      </div>

      <MarginMonitorCard root={root} />

      {scenarios.length > 0 && onNavigate ? (
        <div className="om-card screen__nav-foot">
          <div>
            <strong>Next step: Write & generate report</strong>
            <p className="om-field__hint">
              Draft your narrative sections and generate your evidence-linked opportunity report.
            </p>
          </div>
          <button
            className="om-button om-button--primary"
            onClick={() => onNavigate("Report")}
            type="button"
          >
            Continue to Report →
          </button>
        </div>
      ) : null}
    </section>
  );
}

function AssumptionsForm({ root, initial }: { root: string; initial: CostAssumptions }) {
  const save = useSaveAssumptions(root);
  const [draft, setDraft] = useState<CostAssumptions>(initial);
  const { project } = useProject();
  const currency = project?.manifest.currency ?? "";

  useEffect(() => setDraft(initial), [initial]);

  const moneyField = (label: string, key: "acquisitionCost" | "shippingCost" | "otherCosts") => (
    <Field label={`${label} (${currency})`}>
      <input
        className="om-input om-money"
        inputMode="decimal"
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
        pattern="-?\d+(\.\d{1,2})?"
        required
        value={draft[key]}
      />
    </Field>
  );

  const rateField = (label: string, key: "marketplaceFeeRate" | "paymentFeeRate") => (
    <Field hint="0–100" label={label}>
      <input
        className="om-input om-money"
        inputMode="decimal"
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
        pattern="\d+(\.\d{1,2})?"
        required
        value={draft[key]}
      />
    </Field>
  );

  return (
    <form
      className="om-card screen__form"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(draft);
      }}
    >
      <p className="om-eyebrow">Cost assumptions</p>
      {moneyField("Acquisition cost", "acquisitionCost")}
      {moneyField("Shipping", "shippingCost")}
      {moneyField("Other costs", "otherCosts")}
      {rateField("Marketplace fee rate %", "marketplaceFeeRate")}
      {rateField("Payment fee rate %", "paymentFeeRate")}

      <p className="om-eyebrow">Selling prices</p>
      {(["low", "base", "high"] as const).map((key) => (
        <Field key={key} label={`${key.charAt(0).toUpperCase()}${key.slice(1)} price (${currency})`}>
          <input
            className="om-input om-money"
            inputMode="decimal"
            onChange={(event) =>
              setDraft({
                ...draft,
                scenarioPrices: { ...draft.scenarioPrices, [key]: event.target.value || null },
              })
            }
            pattern="\d+(\.\d{1,2})?"
            value={draft.scenarioPrices[key] ?? ""}
          />
        </Field>
      ))}

      <p className="om-eyebrow">Margin monitor</p>
      <Field hint="0–100 — flags scenarios whose margin at market price falls below this" label="Minimum acceptable margin %">
        <input
          className="om-input om-money"
          inputMode="decimal"
          onChange={(event) =>
            setDraft({ ...draft, marginThresholdPercent: event.target.value || null })
          }
          pattern="\d+(\.\d{1,2})?"
          value={draft.marginThresholdPercent ?? ""}
        />
      </Field>

      <div className="screen__form-foot">
        <button className="om-button om-button--primary" disabled={save.isPending} type="submit">
          {save.isPending ? "Saving…" : "Save assumptions"}
        </button>
      </div>
      {save.isSuccess ? (
        <p className="om-badge om-badge--accent" role="status">
          Saved — ready to calculate
        </p>
      ) : null}
      {save.isError ? <ErrorState error={save.error} onRetry={() => save.mutate(draft)} /> : null}
    </form>
  );
}

function ScenarioPanel({
  root,
  scenarios,
  onCalculate,
  calculating,
  calculateError,
  scenariosPending,
  scenariosQuery,
}: {
  root: string;
  scenarios: EconomicsScenario[];
  onCalculate: () => void;
  calculating: boolean;
  calculateError: unknown;
  scenariosPending: boolean;
  scenariosQuery: { isError: boolean; error: unknown; refetch: () => void };
}) {
  const review = useReviewEconomics(root);
  return (
    <aside className="om-card om-card--inset screen__stats">
      <p className="om-eyebrow">Scenarios</p>
      <button className="om-button om-button--primary" disabled={calculating} onClick={onCalculate} type="button">
        {calculating ? "Calculating…" : "Calculate scenarios"}
      </button>

      {calculateError ? <ErrorState error={calculateError} /> : null}
      {scenariosQuery.isError ? (
        <ErrorState error={scenariosQuery.error} onRetry={() => scenariosQuery.refetch()} />
      ) : null}

      {scenariosPending && !calculating ? (
        <p className="om-loading">
          <span className="om-spinner" /> Loading saved scenarios…
        </p>
      ) : null}

      {scenarios.length === 0 ? (
        <EmptyState title="Not calculated yet">
          <span>Save assumptions with all three selling prices, then calculate.</span>
        </EmptyState>
      ) : (
        <>
          {scenarios.map((scenario) => (
            <article key={scenario.scenario} className="scenario">
              <header className="scenario__head">
                <strong>
                  {scenario.scenario.charAt(0).toUpperCase()}
                  {scenario.scenario.slice(1)}
                </strong>
                <span className="om-badge">{`sell ${scenario.sellingPrice}`}</span>
              </header>
              <LedgerRow label="Marketplace fee" value={scenario.marketplaceFee} tone="muted" />
              <LedgerRow label="Payment fee" value={scenario.paymentFee} tone="muted" />
              <LedgerRow label="Total cost" value={scenario.totalCost} />
              <LedgerRow
                label="Gross profit"
                value={scenario.grossProfit}
                tone={scenario.grossProfit.startsWith("-") ? "muted" : "brass"}
              />
              <LedgerRow label="Gross margin" value={`${scenario.grossMarginPercent}%`} tone="brass" />
            </article>
          ))}

          <button
            className="om-button om-button--secondary"
            disabled={review.isPending || scenarios.length === 0}
            onClick={() => review.mutate()}
            type="button"
          >
            {review.isPending ? "Reviewing…" : "Review with AI"}
          </button>
          {review.isError ? <ErrorState error={review.error} onRetry={() => review.reset()} /> : null}
          {review.data ? (
            <div className="review">
              <span
                className={`om-badge ${
                  review.data.review.verdict === "healthy"
                    ? "om-badge--accent"
                    : review.data.review.verdict === "risk"
                      ? "om-badge--danger"
                      : "om-badge--brass"
                }`}
              >
                {review.data.review.verdict}
              </span>
              <p className="om-field__hint">{review.data.review.summary}</p>
              {review.data.review.findings.map((finding) => (
                <LedgerRow
                  key={finding.message}
                  label={finding.severity}
                  value={finding.message}
                  tone="muted"
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </aside>
  );
}

/**
 * Phase 2 — margin monitoring: deterministic drift flags computed in the core
 * from the saved scenarios against the latest snapshot's median market price.
 */
function MarginMonitorCard({ root }: { root: string }) {
  const monitor = useMarginMonitor(root);

  if (monitor.isPending) {
    return (
      <section className="om-card" aria-label="Margin monitor">
        <p className="om-eyebrow">Margin monitor</p>
        <p className="om-loading">
          <span className="om-spinner" /> Watching market drift…
        </p>
      </section>
    );
  }
  if (monitor.isError) {
    return (
      <section className="om-card" aria-label="Margin monitor">
        <p className="om-eyebrow">Margin monitor</p>
        <ErrorState error={monitor.error} onRetry={() => monitor.refetch()} />
      </section>
    );
  }

  const data = monitor.data.monitor;
  const breached = data.flags.filter((flag) => flag.status === "breached");
  const watching = data.flags.filter((flag) => flag.status === "watch");

  return (
    <section className="om-card" aria-label="Margin monitor">
      <p className="om-eyebrow">Margin monitor</p>
      {data.thresholdPercent === null ? (
        <p className="om-field__hint">
          Set a minimum acceptable margin % in the assumptions to watch market drift.
        </p>
      ) : data.marketPrice === null ? (
        <p className="om-field__hint">
          Capture a market snapshot on the Competitors tab — the monitor compares your scenarios
          against its median price.
        </p>
      ) : (
        <>
          <LedgerRow label="Market reference (median)" value={data.marketPrice} tone="brass" />
          <LedgerRow label="Your minimum margin" value={`${data.thresholdPercent}%`} />
          {breached.length > 0 ? (
            <p className="om-badge om-badge--danger" role="status">
              {breached.length === data.flags.length
                ? "All scenarios breach the threshold at market price"
                : `${breached.length} scenario${breached.length > 1 ? "s" : ""} breach the threshold at market price`}
            </p>
          ) : watching.length > 0 ? (
            <p className="om-badge om-badge--brass" role="status">
              {watching.length} scenario{watching.length > 1 ? "s" : ""} near the threshold
            </p>
          ) : (
            <p className="om-badge om-badge--accent" role="status">
              All scenarios healthy at market price
            </p>
          )}
          <div className="om-ledger">
            {data.flags.map((flag) => (
              <LedgerRow
                key={flag.scenario}
                label={`${flag.scenario} — sell ${flag.sellingPrice}`}
                value={
                  flag.marginAtMarketPrice === null
                    ? "—"
                    : `${flag.marginAtMarketPrice}% (${flag.status})`
                }
                tone={
                  flag.status === "breached"
                    ? "muted"
                    : flag.status === "watch"
                      ? "brass"
                      : undefined
                }
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
