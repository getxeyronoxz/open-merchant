import { useMemo, useState } from "react";

import { Button, EmptyState, InsetPanel, PageHeader, Panel, StatCard, StatusMessage, TableContainer } from "../../components/ui";
import type { Competitor, CompetitorStatistics, EvidenceSource } from "../../types";

type CompetitorStatus = "idle" | "saving" | "saved" | "removing" | "error";

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

export function CompetitorsScreen({
  currency,
  competitors,
  evidence,
  onSave,
  statistics,
}: {
  currency: string;
  competitors: Competitor[];
  evidence: EvidenceSource[];
  onSave: (competitors: Competitor[]) => Promise<void>;
  statistics?: CompetitorStatistics;
}) {
  const [draft, setDraft] = useState<Competitor | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CompetitorStatus>("idle");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const evidenceById = useMemo(() => new Map(evidence.map((source) => [source.id, source])), [evidence]);

  const startAdd = () => {
    setError(null);
    setStatus("idle");
    setPriceInput("");
    setDraft(newCompetitor(nextCompetitorId(competitors), currency));
  };
  const startEdit = (competitor: Competitor) => {
    setError(null);
    setStatus("idle");
    setPriceInput(competitor.price ?? "");
    setDraft(competitor);
  };

  const saveCompetitor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    const price = decimalString(priceInput);
    if (price && !/^\d+\.\d{2}$/.test(price)) {
      setStatus("error");
      setError("Enter a non-negative amount with at most two decimal places.");
      return;
    }
    const saved = { ...draft, price, observedAt: new Date().toISOString() };
    const next = competitors.some((competitor) => competitor.id === saved.id)
      ? competitors.map((competitor) => competitor.id === saved.id ? saved : competitor)
      : [...competitors, saved];
    setStatus("saving");
    setError(null);
    try {
      await onSave(next);
      setDraft(null);
      setStatus("saved");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "The competitor could not be saved.");
    }
  };

  const removeCompetitor = async (competitor: Competitor) => {
    if (!window.confirm(`Remove ${competitor.product}?`)) return;
    setRemovingId(competitor.id);
    setStatus("removing");
    setError(null);
    try {
      await onSave(competitors.filter((item) => item.id !== competitor.id));
      setStatus("saved");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "The competitor could not be removed.");
    } finally {
      setRemovingId(null);
    }
  };

  const statusText = status === "saving"
    ? "Saving competitor"
    : status === "saved"
      ? "Competitor saved"
      : status === "removing"
        ? "Removing competitor"
        : status === "error"
          ? "Competitor action failed"
          : null;
  const statusTone = status === "saved" ? "success" : status === "error" ? "error" : status === "idle" ? "neutral" : "working";
  const statisticValues = [
    ["Minimum", statistics?.minimum],
    ["Median", statistics?.median],
    ["Average", statistics?.average],
    ["Maximum", statistics?.maximum],
  ] as const;

  return (
    <Panel>
      <PageHeader
        action={<Button icon="plus" onClick={startAdd} type="button" variant="primary">Add competitor</Button>}
        description="Compare products against saved sources and keep pricing evidence inspectable."
        eyebrow="Competitors"
        status={<StatusMessage tone={statusTone}>{statusText}</StatusMessage>}
        title="Compare the market you can verify"
      />

      {statistics?.validPriceCount ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statisticValues.map(([label, value]) => (
            <StatCard detail={`${statistics.validPriceCount} priced ${statistics.validPriceCount === 1 ? "record" : "records"}`} key={label} label={label} value={value ? formatCurrency(value, currency) : "—"} />
          ))}
        </div>
      ) : null}

      {draft ? (
        <form className="mt-6" onSubmit={(event) => void saveCompetitor(event)}>
          <InsetPanel>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{draft.id}</p>
                <h3 className="mt-1 text-base font-semibold text-stone-100">{draft.product || "New competitor"}</h3>
              </div>
              <span className="rounded-full border border-stone-800 bg-stone-900 px-2.5 py-1 font-mono text-xs text-stone-400">{currency}</span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Product"><input className="min-h-10 px-3 py-2" value={draft.product} onChange={(event) => setDraft({ ...draft, product: event.target.value })} required /></Field>
              <Field label="Brand"><input className="min-h-10 px-3 py-2" value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} /></Field>
              <Field label="Price"><input className="min-h-10 px-3 py-2 font-mono tabular-nums" inputMode="decimal" value={priceInput} onChange={(event) => setPriceInput(event.target.value)} /></Field>
              <Field label="Marketplace"><input className="min-h-10 px-3 py-2" value={draft.marketplace} onChange={(event) => setDraft({ ...draft, marketplace: event.target.value })} /></Field>
              <Field label="Listing URL"><input className="min-h-10 px-3 py-2" type="url" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} /></Field>
              <Field label="Evidence source">
                <select className="min-h-10 px-3 py-2" value={draft.sourceId ?? ""} onChange={(event) => setDraft({ ...draft, sourceId: event.target.value || null })}>
                  <option value="">None linked</option>
                  {evidence.map((source) => <option key={source.id} value={source.id}>{source.id} — {source.title}</option>)}
                </select>
              </Field>
            </div>
            <label className="mt-4 grid gap-2 text-sm font-semibold text-stone-200">
              Notes
              <textarea className="min-h-20 resize-y px-3 py-2.5" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
            </label>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button disabled={status === "saving"} icon="save" type="submit" variant="primary">{status === "saving" ? "Saving competitor…" : "Save competitor"}</Button>
              <Button disabled={status === "saving"} onClick={() => setDraft(null)} type="button">Cancel</Button>
            </div>
            {error ? <p className="mt-4 rounded-[var(--radius-md)] border border-rose-900/70 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-200" role="alert">{error}</p> : null}
          </InsetPanel>
        </form>
      ) : null}

      {competitors.length > 0 ? (
        <div className="mt-6">
          <TableContainer>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-stone-800 bg-stone-950/50 text-xs font-semibold uppercase tracking-[0.1em] text-stone-500">
                <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Brand</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Marketplace</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {competitors.map((competitor) => {
                  const source = competitor.sourceId ? evidenceById.get(competitor.sourceId) : null;
                  return (
                    <tr className="border-b border-stone-800/80 transition-colors duration-[var(--motion-fast)] last:border-0 hover:bg-stone-900/60" key={competitor.id}>
                      <td className="px-4 py-3.5"><p className="font-semibold text-stone-100">{competitor.product}</p><p className="mt-1 font-mono text-xs text-stone-600">{competitor.id}</p></td>
                      <td className="px-4 py-3.5 text-stone-300">{competitor.brand || "—"}</td>
                      <td className="px-4 py-3.5 font-mono font-semibold tabular-nums text-stone-100">{competitor.price ? formatCurrency(competitor.price, currency) : "Not priced"}</td>
                      <td className="px-4 py-3.5 text-stone-300">{competitor.marketplace || "—"}</td>
                      <td className="px-4 py-3.5 text-stone-400">{competitor.sourceId ? `${competitor.sourceId}${source ? ` · ${source.title}` : ""}` : "—"}</td>
                      <td className="px-4 py-3.5"><div className="flex justify-end gap-1"><Button onClick={() => startEdit(competitor)} size="sm" type="button" variant="ghost">Edit</Button><Button disabled={removingId === competitor.id} onClick={() => void removeCompetitor(competitor)} size="sm" type="button" variant="danger">{removingId === competitor.id ? "Removing…" : "Remove"}</Button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableContainer>
        </div>
      ) : !draft ? (
        <div className="mt-6">
          <EmptyState
            action={<Button icon="plus" onClick={startAdd} size="sm" type="button" variant="secondary">Add first competitor</Button>}
            description="Add comparable products to make your verified price range visible."
            icon="competitors"
            title="No competitors recorded yet"
          />
        </div>
      ) : null}
      {error && !draft ? <p className="mt-4 rounded-[var(--radius-md)] border border-rose-900/70 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-200" role="alert">{error}</p> : null}
    </Panel>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-stone-200">{label}{children}</label>;
}

function formatCurrency(value: string, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}
