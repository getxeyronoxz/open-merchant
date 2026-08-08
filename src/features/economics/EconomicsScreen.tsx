import { useEffect, useState } from "react";
import type { CostAssumptions } from "../../types";

const fields = [
  ["acquisitionCost", "Acquisition cost"], ["shippingCost", "Shipping and logistics"], ["marketplaceFeeRate", "Marketplace fee rate (%)"], ["paymentFeeRate", "Payment fee rate (%)"], ["otherCosts", "Other costs"],
] as const;
const priceFields = [["low", "Low selling price"], ["base", "Base selling price"], ["high", "High selling price"]] as const;

function canonical(value: string, nullable = false) {
  const trimmed = value.trim(); if (nullable && !trimmed) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed || "0"); return match ? `${match[1]}.${(match[2] ?? "").padEnd(2, "0")}` : trimmed;
}

export function EconomicsScreen({ assumptions, onSave }: { assumptions: CostAssumptions; onSave: (assumptions: CostAssumptions) => Promise<void> }) {
  const [draft, setDraft] = useState(assumptions); const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(assumptions), [assumptions]);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = { ...draft, acquisitionCost: canonical(draft.acquisitionCost) ?? "0.00", shippingCost: canonical(draft.shippingCost) ?? "0.00", marketplaceFeeRate: canonical(draft.marketplaceFeeRate) ?? "0.00", paymentFeeRate: canonical(draft.paymentFeeRate) ?? "0.00", otherCosts: canonical(draft.otherCosts) ?? "0.00", scenarioPrices: { low: canonical(draft.scenarioPrices.low ?? "", true), base: canonical(draft.scenarioPrices.base ?? "", true), high: canonical(draft.scenarioPrices.high ?? "", true) } };
    if ([next.acquisitionCost, next.shippingCost, next.marketplaceFeeRate, next.paymentFeeRate, next.otherCosts, ...Object.values(next.scenarioPrices).filter(Boolean)].some((value) => !/^\d+\.\d{2}$/.test(value!))) { setError("Use non-negative decimal amounts with at most two fractional digits."); return; }
    try { setError(null); await onSave(next); setDraft(next); setSaved(true); } catch (reason) { setError(reason instanceof Error ? reason.message : "The assumptions could not be saved."); }
  };
  return <section className="rounded-xl border border-stone-800 bg-stone-900 p-6"><div><p className="text-sm font-medium text-emerald-300">Unit economics</p><h2 className="mt-1 text-2xl font-semibold">Make your cost assumptions explicit</h2></div><form className="mt-6 grid gap-5" onSubmit={(event) => void save(event)}><div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label]) => <label className="grid gap-2 text-sm font-medium" key={key}>{label}<input className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" inputMode="decimal" value={draft[key]} onChange={(event) => { setSaved(false); setDraft({ ...draft, [key]: event.target.value }); }} /></label>)}</div><div className="border-t border-stone-800 pt-5"><h3 className="font-semibold">Selling price scenarios</h3><div className="mt-3 grid gap-4 sm:grid-cols-3">{priceFields.map(([key, label]) => <label className="grid gap-2 text-sm font-medium" key={key}>{label}<input className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" inputMode="decimal" value={draft.scenarioPrices[key] ?? ""} onChange={(event) => { setSaved(false); setDraft({ ...draft, scenarioPrices: { ...draft.scenarioPrices, [key]: event.target.value || null } }); }} /></label>)}</div></div><div className="flex flex-wrap items-center gap-3"><button className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-stone-950" type="submit">Save assumptions</button>{saved ? <span className="text-sm text-emerald-300">Saved</span> : null}{error ? <span className="text-sm text-rose-300" role="alert">{error}</span> : null}</div><p className="rounded-lg bg-stone-950/60 p-3 text-sm text-stone-400">Calculate scenarios to see margins.</p></form></section>;
}
