import { useEffect, useState } from "react";

import { Button, EmptyState, InsetPanel, PageHeader, Panel, StatusMessage } from "../../components/ui";
import type { CostAssumptions, EconomicsScenario } from "../../types";

const fields = [
  ["acquisitionCost", "Acquisition cost"],
  ["shippingCost", "Shipping and logistics"],
  ["marketplaceFeeRate", "Marketplace fee rate (%)"],
  ["paymentFeeRate", "Payment fee rate (%)"],
  ["otherCosts", "Other costs"],
] as const;
const priceFields = [
  ["low", "Low selling price"],
  ["base", "Base selling price"],
  ["high", "High selling price"],
] as const;

type WorkflowStatus = "idle" | "working" | "success" | "error";

function canonical(value: string, nullable = false) {
  const trimmed = value.trim();
  if (nullable && !trimmed) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed || "0");
  return match ? `${match[1]}.${(match[2] ?? "").padEnd(2, "0")}` : trimmed;
}

export function EconomicsScreen({
  assumptions,
  onSave,
  scenarios = [],
  onCalculate,
}: {
  assumptions: CostAssumptions;
  onSave: (assumptions: CostAssumptions) => Promise<void>;
  scenarios?: EconomicsScenario[];
  onCalculate?: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(assumptions);
  const [saveStatus, setSaveStatus] = useState<WorkflowStatus>("idle");
  const [calculationStatus, setCalculationStatus] = useState<WorkflowStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  useEffect(() => setDraft(assumptions), [assumptions]);

  const updateDraft = (next: CostAssumptions) => {
    setSaveStatus("idle");
    setDraft(next);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = {
      ...draft,
      acquisitionCost: canonical(draft.acquisitionCost) ?? "0.00",
      shippingCost: canonical(draft.shippingCost) ?? "0.00",
      marketplaceFeeRate: canonical(draft.marketplaceFeeRate) ?? "0.00",
      paymentFeeRate: canonical(draft.paymentFeeRate) ?? "0.00",
      otherCosts: canonical(draft.otherCosts) ?? "0.00",
      scenarioPrices: {
        low: canonical(draft.scenarioPrices.low ?? "", true),
        base: canonical(draft.scenarioPrices.base ?? "", true),
        high: canonical(draft.scenarioPrices.high ?? "", true),
      },
    };
    const values = [
      next.acquisitionCost,
      next.shippingCost,
      next.marketplaceFeeRate,
      next.paymentFeeRate,
      next.otherCosts,
      ...Object.values(next.scenarioPrices).filter(Boolean),
    ];
    if (values.some((value) => !/^\d+\.\d{2}$/.test(value!))) {
      setSaveStatus("error");
      setSaveError("Use non-negative decimal amounts with at most two fractional digits.");
      return;
    }
    setSaveStatus("working");
    setSaveError(null);
    try {
      await onSave(next);
      setDraft(next);
      setSaveStatus("success");
    } catch (reason) {
      setSaveStatus("error");
      setSaveError(reason instanceof Error ? reason.message : "The assumptions could not be saved.");
    }
  };

  const calculate = async () => {
    if (!onCalculate) return;
    setCalculationStatus("working");
    setCalculationError(null);
    try {
      await onCalculate();
      setCalculationStatus("success");
    } catch (reason) {
      setCalculationStatus("error");
      setCalculationError(reason instanceof Error ? reason.message : "Scenario generation failed.");
    }
  };

  return (
    <Panel>
      <PageHeader
        description="Keep every cost and selling-price assumption visible before comparing margins."
        eyebrow="Unit economics"
        title="Make your cost assumptions explicit"
      />

      <form className="mt-6 grid gap-5" onSubmit={(event) => void save(event)}>
        <InsetPanel>
          <div>
            <h3 className="text-base font-semibold text-stone-100">Cost assumptions</h3>
            <p className="mt-1 text-sm leading-6 text-stone-500">Shared unit costs and fee rates applied by the deterministic commerce engine.</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {fields.map(([key, label]) => (
              <label className="grid gap-2 text-sm font-semibold text-stone-200" key={key}>
                {label}
                <input
                  className="min-h-10 px-3 py-2 font-mono tabular-nums"
                  inputMode="decimal"
                  value={draft[key]}
                  onChange={(event) => updateDraft({ ...draft, [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
        </InsetPanel>

        <InsetPanel>
          <div>
            <h3 className="text-base font-semibold text-stone-100">Selling price scenarios</h3>
            <p className="mt-1 text-sm leading-6 text-stone-500">Set low, base, and high prices. Calculation reads the assumptions saved to this project.</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {priceFields.map(([key, label]) => (
              <label className="grid gap-2 text-sm font-semibold text-stone-200" key={key}>
                {label}
                <input
                  className="min-h-10 px-3 py-2 font-mono tabular-nums"
                  inputMode="decimal"
                  value={draft.scenarioPrices[key] ?? ""}
                  onChange={(event) => updateDraft({
                    ...draft,
                    scenarioPrices: { ...draft.scenarioPrices, [key]: event.target.value || null },
                  })}
                />
              </label>
            ))}
          </div>
        </InsetPanel>

        <div className="flex flex-wrap items-center gap-3">
          {onCalculate ? (
            <Button disabled={calculationStatus === "working"} icon="calculator" onClick={() => void calculate()} type="button" variant="primary">
              {calculationStatus === "working" ? "Calculating…" : "Calculate and save scenarios"}
            </Button>
          ) : null}
          <Button disabled={saveStatus === "working"} icon="save" type="submit">
            {saveStatus === "working" ? "Saving assumptions…" : "Save assumptions"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <StatusMessage
            label="Assumptions status"
            tone={saveStatus === "success" ? "success" : saveStatus === "error" ? "error" : saveStatus === "working" ? "working" : "neutral"}
          >
            {saveStatus === "working" ? "Saving assumptions" : saveStatus === "success" ? "Assumptions saved" : saveStatus === "error" ? "Save failed" : null}
          </StatusMessage>
          {onCalculate ? (
            <StatusMessage
              label="Calculation status"
              tone={calculationStatus === "success" ? "success" : calculationStatus === "error" ? "error" : calculationStatus === "working" ? "working" : "neutral"}
            >
              {calculationStatus === "working" ? "Calculating scenarios" : calculationStatus === "success" ? "Scenarios calculated" : calculationStatus === "error" ? "Calculation failed" : null}
            </StatusMessage>
          ) : null}
        </div>
        {saveError ? <p className="rounded-[var(--radius-md)] border border-rose-900/70 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-200" role="alert">{saveError}</p> : null}
        {calculationError ? <p className="rounded-[var(--radius-md)] border border-rose-900/70 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-200" role="alert">{calculationError}</p> : null}
      </form>

      <div className="mt-7 border-t border-stone-800 pt-6">
        <div>
          <h3 className="text-base font-semibold text-stone-100">Scenario results</h3>
          <p className="mt-1 text-sm text-stone-500">Values below come from the saved deterministic calculation.</p>
        </div>
        {scenarios.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {scenarios.map((scenario) => <ScenarioCard currency={assumptions.currency} key={scenario.scenario} scenario={scenario} />)}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState description="Save your assumptions, then calculate the low, base, and high selling-price scenarios." icon="calculator" title="No calculated scenarios yet" />
          </div>
        )}
      </div>
    </Panel>
  );
}

function ScenarioCard({ currency, scenario }: { currency: string; scenario: EconomicsScenario }) {
  const profitable = Number(scenario.grossProfit) >= 0;
  return (
    <article className={`rounded-[var(--radius-lg)] border p-4 ${scenario.scenario === "base" ? "border-emerald-900/80 bg-emerald-950/15" : "border-stone-800 bg-stone-950/40"}`}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">{scenario.scenario} scenario</h4>
        {scenario.scenario === "base" ? <span className="rounded-full border border-emerald-900/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Base</span> : null}
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight text-stone-50">{formatCurrency(scenario.sellingPrice, currency)}</p>
      <dl className="mt-4 grid gap-2 border-t border-stone-800/80 pt-3 text-sm">
        <div className="flex items-center justify-between gap-3"><dt className="text-stone-500">Total cost</dt><dd className="font-mono tabular-nums text-stone-300">{formatCurrency(scenario.totalCost, currency)}</dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-stone-500">Gross profit</dt><dd className={`font-mono font-semibold tabular-nums ${profitable ? "text-emerald-300" : "text-rose-300"}`}>{formatCurrency(scenario.grossProfit, currency)}</dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-stone-500">Gross margin</dt><dd className={`font-mono font-semibold tabular-nums ${profitable ? "text-stone-100" : "text-rose-300"}`}>{scenario.grossMarginPercent}%</dd></div>
      </dl>
    </article>
  );
}

function formatCurrency(value: string, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}
