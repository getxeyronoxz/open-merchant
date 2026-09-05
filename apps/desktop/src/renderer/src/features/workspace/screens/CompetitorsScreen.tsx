import { useState } from "react";

import type { Competitor, CompetitorDraft, MarketSnapshot } from "@open-merchant/shared";
import { EmptyState, ErrorState, Field, LedgerRow } from "@open-merchant/ui";

import { useProject } from "../../../state/project";
import {
  useCaptureMarketSnapshot,
  useCompetitorStatistics,
  useCompetitors,
  useDraftCompetitors,
  useMarketPriceHistory,
  useMarketSnapshots,
  useSaveCompetitors,
  useSnapshotDiff,
} from "../queries";
import type { SectionName } from "../useWorkflowProgress";

function nextCompetitorId(existing: Competitor[]): string {
  const highest = existing.reduce((max, competitor) => {
    const match = /^C-(\d+)$/u.exec(competitor.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `C-${String(highest + 1).padStart(3, "0")}`;
}

/** Market landscape: comparable listings and the price statistics they imply. */
export function CompetitorsScreen({
  root,
  onNavigate,
}: {
  root: string;
  onNavigate?: (section: SectionName) => void;
}) {
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
              placeholder="Nova"
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

      <MarketSnapshotsCard root={root} currency={projectCurrency} />

      {competitors.length > 0 && onNavigate ? (
        <div className="om-card screen__nav-foot">
          <div>
            <strong>Next step: Model unit economics</strong>
            <p className="om-field__hint">
              Enter your cost assumptions and calculate 3-tier price scenarios (Low, Base, High).
            </p>
          </div>
          <button
            className="om-button om-button--primary"
            onClick={() => onNavigate("Economics")}
            type="button"
          >
            Continue to Economics →
          </button>
        </div>
      ) : null}
    </section>
  );
}

function fmt(value: string | null, currency: string): string {
  return value === null ? "—" : `${currency} ${value}`;
}

/**
 * Phase 2 — market snapshots: immutable captures of the listing set with a
 * derived per-listing price history and a diff between any two captures.
 */
function MarketSnapshotsCard({ root, currency }: { root: string; currency: string }) {
  const snapshotsQuery = useMarketSnapshots(root);
  const historyQuery = useMarketPriceHistory(root);
  const capture = useCaptureMarketSnapshot(root);
  const [note, setNote] = useState("");
  const [pickedFrom, setPickedFrom] = useState<string | null>(null);
  const [pickedTo, setPickedTo] = useState<string | null>(null);

  const snapshots: MarketSnapshot[] = snapshotsQuery.data?.snapshots ?? [];
  const fromId = pickedFrom ?? snapshots[1]?.id ?? null;
  const toId = pickedTo ?? snapshots[0]?.id ?? null;
  const diff = useSnapshotDiff(root, fromId, toId);
  const diffData = diff.data?.diff ?? null;
  const showDiff = diffData !== null && fromId !== null && toId !== null && fromId !== toId;

  const captureSnapshot = () => {
    capture.mutate(note, { onSuccess: () => setNote("") });
  };

  return (
    <section className="om-card" aria-label="Market snapshots">
      <div className="screen__grid">
        <div>
          <p className="om-eyebrow">Market snapshots</p>
          <p className="om-field__hint">
            Freeze the whole listing set at a moment in time. Snapshots are immutable; price
            history and diffs build up as you capture more.
          </p>
          <div className="om-field">
            <label className="om-label" htmlFor="snapshot-note">
              Snapshot note (optional)
            </label>
            <input
              className="om-input"
              id="snapshot-note"
              onChange={(event) => setNote(event.target.value)}
              placeholder="First market scan"
              type="text"
              value={note}
            />
          </div>
          <button
            className="om-button om-button--primary"
            disabled={capture.isPending}
            onClick={captureSnapshot}
            type="button"
          >
            {capture.isPending ? "Capturing…" : "Capture snapshot"}
          </button>
          {capture.isError ? <ErrorState error={capture.error} /> : null}
        </div>

        <aside className="om-card om-card--inset screen__stats">
          <p className="om-eyebrow">Compare</p>
          {snapshots.length < 2 ? (
            <p className="om-field__hint">
              Capture two snapshots to see exactly which listing moved.
            </p>
          ) : (
            <>
              <div className="om-field">
                <label className="om-label" htmlFor="snapshot-from">
                  From
                </label>
                <select
                  className="om-input"
                  id="snapshot-from"
                  onChange={(event) => setPickedFrom(event.target.value || null)}
                  value={fromId ?? ""}
                >
                  {snapshots.map((snapshot, index) => (
                    <option key={snapshot.id} value={snapshot.id}>
                      {new Date(snapshot.capturedAt).toLocaleString()}
                      {index === 0 ? " — latest" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="om-field">
                <label className="om-label" htmlFor="snapshot-to">
                  To
                </label>
                <select
                  className="om-input"
                  id="snapshot-to"
                  onChange={(event) => setPickedTo(event.target.value || null)}
                  value={toId ?? ""}
                >
                  {snapshots.map((snapshot, index) => (
                    <option key={snapshot.id} value={snapshot.id}>
                      {new Date(snapshot.capturedAt).toLocaleString()}
                      {index === 0 ? " — latest" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </aside>
      </div>
      {diff.isError ? <ErrorState error={diff.error} onRetry={() => diff.refetch()} /> : null}
      {showDiff && diffData ? (
        <>
          <p className="om-eyebrow">
            Changes — {diffData.added.length} added · {diffData.removed.length} removed ·{" "}
            {diffData.priceChanges.length} repriced
          </p>
          {diffData.priceChanges.length === 0 &&
          diffData.added.length === 0 &&
          diffData.removed.length === 0 ? (
            <p className="om-field__hint">No listing moved between these two snapshots.</p>
          ) : (
            <table className="om-table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Brand</th>
                  <th>Change</th>
                  <th className="om-num">From</th>
                  <th className="om-num">To</th>
                </tr>
              </thead>
              <tbody>
                {diffData.priceChanges.map((change) => (
                  <tr key={`change-${change.key}`}>
                    <td>{change.product}</td>
                    <td>{change.brand}</td>
                    <td>Repriced</td>
                    <td className="om-num">{fmt(change.fromPrice, currency)}</td>
                    <td className="om-num">{fmt(change.toPrice, currency)}</td>
                  </tr>
                ))}
                {diffData.added.map((listing) => (
                  <tr key={`added-${listing.id}`}>
                    <td>{listing.product}</td>
                    <td>{listing.brand}</td>
                    <td>Added</td>
                    <td className="om-num">—</td>
                    <td className="om-num">{fmt(listing.price, currency)}</td>
                  </tr>
                ))}
                {diffData.removed.map((listing) => (
                  <tr key={`removed-${listing.id}`}>
                    <td>{listing.product}</td>
                    <td>{listing.brand}</td>
                    <td>Removed</td>
                    <td className="om-num">{fmt(listing.price, currency)}</td>
                    <td className="om-num">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
      {historyQuery.isError ? (
        <ErrorState error={historyQuery.error} onRetry={() => historyQuery.refetch()} />
      ) : null}
      {historyQuery.data && historyQuery.data.history.length > 0 && snapshots.length > 0 ? (
        <>
          <p className="om-eyebrow">Price history per listing</p>
          <table className="om-table">
            <thead>
              <tr>
                <th>Listing</th>
                {snapshots
                  .slice()
                  .reverse()
                  .map((snapshot) => (
                    <th className="om-num" key={snapshot.id}>
                      {new Date(snapshot.capturedAt).toLocaleDateString()}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {historyQuery.data.history.map((entry) => (
                <tr key={entry.key}>
                  <td>
                    {entry.product}
                    {entry.brand ? ` — ${entry.brand}` : ""}
                  </td>
                  {snapshots
                    .slice()
                    .reverse()
                    .map((snapshot) => {
                      const point = entry.points.find((p) => p.snapshotId === snapshot.id);
                      return (
                        <td className="om-num" key={`${entry.key}-${snapshot.id}`}>
                          {fmt(point?.price ?? null, currency)}
                        </td>
                      );
                    })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      {snapshotsQuery.isError ? (
        <ErrorState error={snapshotsQuery.error} onRetry={() => snapshotsQuery.refetch()} />
      ) : null}
    </section>
  );
}
