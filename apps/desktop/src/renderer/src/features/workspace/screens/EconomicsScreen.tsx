import { useEffect, useState } from "react";

import type { CostAssumptions, EconomicsScenario } from "@open-merchant/shared";
import { EmptyState, ErrorState, Field, LedgerRow } from "@open-merchant/ui";

import { useProject } from "../../../state/project";
import {
  useAssumptions,
  useCalculateScenarios,
  useSaveAssumptions,
  useScenarios,
} from "../queries";

/**
 * Unit economics: cost assumptions and low/base/high price scenarios.
 * All math happens in the deterministic core — the UI only edits inputs.
 */
export function EconomicsScreen({ root }: { root: string }) {
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
          calculateError={calculate.error}
          calculating={calculate.isPending}
          onCalculate={() => calculate.mutate()}
          scenarios={scenariosQuery.data?.scenarios ?? []}
          scenariosPending={scenariosQuery.isPending}
          scenariosQuery={scenariosQuery}
        />
      </div>
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
  scenarios,
  onCalculate,
  calculating,
  calculateError,
  scenariosPending,
  scenariosQuery,
}: {
  scenarios: EconomicsScenario[];
  onCalculate: () => void;
  calculating: boolean;
  calculateError: unknown;
  scenariosPending: boolean;
  scenariosQuery: { isError: boolean; error: unknown; refetch: () => void };
}) {
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
        </>
      )}
    </aside>
  );
}
