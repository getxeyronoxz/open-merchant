import { useState } from "react";

import type { Competitor, EvidenceSource } from "../../types";

function nextCompetitorId(competitors: Competitor[]) {
  const highest = competitors.reduce((max, competitor) => Math.max(max, Number(/^C-(\d+)$/.exec(competitor.id)?.[1] ?? 0)), 0);
  return `C-${String(highest + 1).padStart(3, "0")}`;
}

function decimalString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  return match ? `${match[1]}.${(match[2] ?? "").padEnd(2, "0")}` : trimmed;
}

function newCompetitor(id: string, currency: string): Competitor {
  return { schemaVersion: 1, id, product: "", brand: "", price: null, currency, marketplace: "", url: "", sourceId: null, notes: "", observedAt: new Date().toISOString() };
}

export function CompetitorsScreen({ currency, competitors, evidence, onSave }: { currency: string; competitors: Competitor[]; evidence: EvidenceSource[]; onSave: (competitors: Competitor[]) => Promise<void>; }) {
  const [draft, setDraft] = useState<Competitor | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const startAdd = () => { setError(null); setPriceInput(""); setDraft(newCompetitor(nextCompetitorId(competitors), currency)); };
  const startEdit = (competitor: Competitor) => { setError(null); setPriceInput(competitor.price ?? ""); setDraft(competitor); };
  const saveCompetitor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    const price = decimalString(priceInput);
    if (price && !/^\d+\.\d{2}$/.test(price)) { setError("Enter a non-negative amount with at most two decimal places."); return; }
    const saved = { ...draft, price, observedAt: new Date().toISOString() };
    const next = competitors.some((competitor) => competitor.id === saved.id) ? competitors.map((competitor) => competitor.id === saved.id ? saved : competitor) : [...competitors, saved];
    try { setError(null); await onSave(next); setDraft(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "The competitor could not be saved."); }
  };
  const removeCompetitor = async (competitor: Competitor) => { if (window.confirm(`Remove ${competitor.product}?`)) await onSave(competitors.filter((item) => item.id !== competitor.id)); };

  return <section className="rounded-xl border border-stone-800 bg-stone-900 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-emerald-300">Competitors</p><h2 className="mt-1 text-2xl font-semibold">Compare the market you can verify</h2></div><button className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-stone-950" onClick={startAdd} type="button">Add competitor</button></div>
    {draft ? <form className="mt-6 grid gap-4 border-t border-stone-800 pt-6" onSubmit={(event) => void saveCompetitor(event)}>
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Product<input className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" value={draft.product} onChange={(event) => setDraft({ ...draft, product: event.target.value })} required /></label><label className="grid gap-2 text-sm font-medium">Brand<input className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} /></label><label className="grid gap-2 text-sm font-medium">Price<input className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" inputMode="decimal" value={priceInput} onChange={(event) => setPriceInput(event.target.value)} /></label><label className="grid gap-2 text-sm font-medium">Marketplace<input className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" value={draft.marketplace} onChange={(event) => setDraft({ ...draft, marketplace: event.target.value })} /></label><label className="grid gap-2 text-sm font-medium">Listing URL<input className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" type="url" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} /></label><label className="grid gap-2 text-sm font-medium">Evidence source<select className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" value={draft.sourceId ?? ""} onChange={(event) => setDraft({ ...draft, sourceId: event.target.value || null })}><option value="">None linked</option>{evidence.map((source) => <option key={source.id} value={source.id}>{source.id} — {source.title}</option>)}</select></label></div>
      <label className="grid gap-2 text-sm font-medium">Notes<textarea className="min-h-20 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label><p className="text-sm text-stone-400">Currency: {currency}</p><div className="flex gap-3"><button className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-stone-950" type="submit">Save competitor</button><button className="rounded-lg border border-stone-700 px-4 py-2" onClick={() => setDraft(null)} type="button">Cancel</button></div>{error ? <p className="text-sm text-rose-300" role="alert">{error}</p> : null}
    </form> : null}
    <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-stone-700 text-stone-400"><tr><th className="p-3">Product</th><th className="p-3">Brand</th><th className="p-3">Price</th><th className="p-3">Marketplace</th><th className="p-3">Evidence</th><th className="p-3">Actions</th></tr></thead><tbody>{competitors.map((competitor) => <tr className="border-b border-stone-800" key={competitor.id}><td className="p-3 font-medium">{competitor.product}</td><td className="p-3">{competitor.brand || "—"}</td><td className="p-3">{competitor.price ? `${currency} ${competitor.price}` : "Not priced"}</td><td className="p-3">{competitor.marketplace || "—"}</td><td className="p-3">{competitor.sourceId ?? "—"}</td><td className="p-3"><button className="mr-3 underline" onClick={() => startEdit(competitor)} type="button">Edit</button><button className="text-rose-300 underline" onClick={() => void removeCompetitor(competitor)} type="button">Remove</button></td></tr>)}</tbody></table></div>
    {competitors.length === 0 && !draft ? <p className="mt-6 text-stone-400">Add comparable products to make your price range visible.</p> : null}
  </section>;
}
