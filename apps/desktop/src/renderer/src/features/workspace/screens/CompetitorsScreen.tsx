import { useState } from "react";

import type { Competitor, CompetitorDraft } from "@open-merchant/shared";
import { EmptyState, ErrorState, Field, LedgerRow } from "@open-merchant/ui";

import { useProject } from "../../../state/project";
import {
  useCompetitorStatistics,
  useCompetitors,
  useDraftCompetitors,
  useSaveCompetitors,
} from "../queries";

function nextCompetitorId(existing: Competitor[]): string {
  const highest = existing.reduce((max, competitor) => {
    const match = /^C-(\d+)$/u.exec(competitor.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `C-${String(highest + 1).padStart(3, "0")}`;
}

/** Market landscape: comparable listings and the price statistics they imply. */
export function CompetitorsScreen({ root }: { root: string }) {
  const query = useCompetitors(root);
  const statistics = useCompetitorStatistics(root);
  const save = useSaveCompetitors(root);
  const draftAi = useDraftCompetitors(root);
  const [form, setForm] = useState({ product: "", brand: "", price: "", marketplace: "", url: "" });
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiDrafts, setAiDrafts] = useState<CompetitorDraft[] | null>(null);
  const { project } = useProject();
  const projectCurrency = project?.manifest.currency ?? "";

  if (query.isPending) {
    return (
      <p className="om-loading">
        <span className="om-spinner" /> Loading competitors…
      </p>
    );
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const competitors = query.data.competitors;
  const stats = statistics.data?.statistics;

  const addCompetitor = () => {
    const next: Competitor = {
      id: nextCompetitorId(competitors),
      product: form.product,
      brand: form.brand,
      price: form.price.trim() === "" ? null : form.price,
      currency: projectCurrency,
      marketplace: form.marketplace,
      url: form.url,
      sourceId: null,
      notes: "",
      observedAt: new Date().toISOString(),
    };
    save.mutate([...competitors, next], {
      onSuccess: () => setForm({ product: "", brand: "", price: "", marketplace: "", url: "" }),
    });
  };

  const removeCompetitor = (id: string) => {
    save.mutate(competitors.filter((competitor) => competitor.id !== id));
  };

  const acceptAiDrafts = () => {
    if (!aiDrafts) return;
    let nextIdNumber = competitors.length + 1;
    const existingIds = new Set(competitors.map((competitor) => competitor.id));
    const additions: Competitor[] = aiDrafts.map((draft) => {
      let id = `C-${String(nextIdNumber).padStart(3, "0")}`;
      while (existingIds.has(id)) {
        nextIdNumber += 1;
        id = `C-${String(nextIdNumber).padStart(3, "0")}`;
      }
      existingIds.add(id);
      nextIdNumber += 1;
      return {
        id,
        product: draft.product,
        brand: draft.brand,
        price: draft.price,
        currency: projectCurrency,
        marketplace: draft.marketplace,
        url: draft.url,
        sourceId: null,
        notes: "",
        observedAt: new Date().toISOString(),
      };
    });
    save.mutate([...competitors, ...additions], {
      onSuccess: () => {
        setAiDrafts(null);
        setAiPanelOpen(false);
      },
    });
  };

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="om-eyebrow">Competitors</p>
        <h1 className="om-section-title">Who else is selling this?</h1>
        <p className="om-section-sub">
          Comparable listings only — unpriced entries are ignored by the statistics.
        </p>
      </header>

      {aiPanelOpen ? (
        <form
          className="om-card screen__form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            draftAi.mutate(String(data.get("pastedListings") ?? ""), {
              onSuccess: (result) => setAiDrafts(result.competitors),
            });
          }}
        >
          <p className="om-eyebrow">Competitor analyst</p>
          <Field
            hint="The assistant reads only what you paste here."
            label="Paste listing material"
          >
            <textarea
              className="om-textarea"
              name="pastedListings"
              placeholder="Copy one or more listings in here — title, price, marketplace…"
              required
            />
          </Field>
          <div className="screen__actions">
            <button className="om-button om-button--secondary" onClick={() => setAiPanelOpen(false)} type="button">
              Cancel
            </button>
            <button className="om-button om-button--primary" disabled={draftAi.isPending} type="submit">
              {draftAi.isPending ? "Extracting…" : "Extract drafts"}
            </button>
          </div>
          {draftAi.isError ? <ErrorState error={draftAi.error} onRetry={() => draftAi.reset()} /> : null}
          {aiDrafts ? (
            <div className="screen__stack">
              <span className="om-badge om-badge--brass">
                AI draft — review before adding ({aiDrafts.length})
              </span>
              {aiDrafts.map((draft, index) => (
                <LedgerRow
                  key={`${draft.product}-${index}`}
                  label={draft.product}
                  value={draft.price ?? "unpriced"}
                  tone="muted"
                />
              ))}
              <button className="om-button om-button--primary" disabled={save.isPending} onClick={acceptAiDrafts} type="button">
                Add all to market landscape
              </button>
            </div>
          ) : null}
        </form>
      ) : null}

      <div className="screen__columns">
        <form
          className="om-card screen__form"
          onSubmit={(event) => {
            event.preventDefault();
            addCompetitor();
          }}
        >
          <Field label={`Product (${projectCurrency})`}>
            <input
              className="om-input"
              onChange={(event) => setForm({ ...form, product: event.target.value })}
              placeholder="65% hot-swappable keyboard"
              required
              value={form.product}
            />
          </Field>
          <Field label="Brand">
            <input
              className="om-input"
              onChange={(event) => setForm({ ...form, brand: event.target.value })}
              value={form.brand}
            />
          </Field>
          <Field hint="Leave empty for an unpriced listing." label="Asking price">
            <input
              className="om-input om-money"
              inputMode="decimal"
              onChange={(event) => setForm({ ...form, price: event.target.value })}
              pattern="-?\d+(\.\d{1,2})?"
              value={form.price}
            />
          </Field>
          <Field label="Marketplace">
            <input
              className="om-input"
              onChange={(event) => setForm({ ...form, marketplace: event.target.value })}
              value={form.marketplace}
            />
          </Field>
          <Field label="Listing URL">
            <input
              className="om-input"
              onChange={(event) => setForm({ ...form, url: event.target.value })}
              type="url"
              value={form.url}
            />
          </Field>
          <button className="om-button om-button--primary" disabled={save.isPending} type="submit">
            Add listing
          </button>
          <button className="om-button om-button--secondary" onClick={() => setAiPanelOpen((open) => !open)} type="button">
            {aiPanelOpen ? "Hide AI drafting" : "Draft listings with AI"}
          </button>
          {save.isError ? <ErrorState error={save.error} /> : null}
        </form>

        <aside className="om-card om-card--inset screen__stats">
          <p className="om-eyebrow">Price statistics</p>
          {statistics.isPending || !stats ? (
            <p className="om-loading">
              <span className="om-spinner" /> Computing…
            </p>
          ) : (
            <div className="om-ledger">
              <LedgerRow label="Priced listings" value={String(stats.validPriceCount)} />
              <LedgerRow label="Minimum" value={fmt(stats.minimum, projectCurrency)} tone="brass" />
              <LedgerRow label="Maximum" value={fmt(stats.maximum, projectCurrency)} tone="brass" />
              <LedgerRow label="Average" value={fmt(stats.average, projectCurrency)} />
              <LedgerRow label="Median" value={fmt(stats.median, projectCurrency)} tone="brass" />
            </div>
          )}
          {statistics.isError ? (
            <ErrorState error={statistics.error} onRetry={() => statistics.refetch()} />
          ) : null}
        </aside>
      </div>

      {competitors.length === 0 ? (
        <EmptyState title="No listings yet">
          <span>Add a few comparables to see the market's price range.</span>
        </EmptyState>
      ) : (
        <table className="om-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Product</th>
              <th>Brand</th>
              <th className="om-num">Price</th>
              <th>Marketplace</th>
              <th>
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {competitors.map((competitor) => (
              <tr key={competitor.id}>
                <td className="om-data">{competitor.id}</td>
                <td>{competitor.product}</td>
                <td>{competitor.brand}</td>
                <td className="om-num">{competitor.price ?? "—"}</td>
                <td>{competitor.marketplace}</td>
                <td>
                  <button
                    aria-label={`Remove ${competitor.product}`}
                    className="om-button om-button--ghost"
                    onClick={() => removeCompetitor(competitor.id)}
                    type="button"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function fmt(value: string | null, currency: string): string {
  return value === null ? "—" : `${currency} ${value}`;
}
