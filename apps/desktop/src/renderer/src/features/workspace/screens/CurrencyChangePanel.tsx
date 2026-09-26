import type { CurrencyChangePreview } from "@open-merchant/shared";
import { Button, ErrorState, Field } from "@open-merchant/ui";

/**
 * Restating a project in another currency.
 *
 * This is the only screen that rewrites every amount a project owns, so it
 * shows the change as a before → after diff and refuses to confirm anything the
 * seller has not seen: `previewMatches` is what makes "the rate on screen is
 * the rate that will be applied" checkable rather than assumed.
 */

/** How many converted values to show before summarising the rest. */
const DIFF_ROWS = 20;

export interface CurrencyChangePanelProps {
  /** The project's currency right now — the change always starts from here. */
  readonly currency: string;
  readonly toCurrency: string;
  readonly rate: string;
  readonly preview: CurrencyChangePreview | null;
  readonly isPreviewing: boolean;
  readonly isApplying: boolean;
  readonly error: unknown;
  readonly onCurrencyChange: (value: string) => void;
  readonly onRateChange: (value: string) => void;
  readonly onPreview: () => void;
  readonly onApply: () => void;
  readonly onRetry: () => void;
}

/**
 * Whether the inputs on screen still describe the preview being offered.
 *
 * Confirming anything else would apply a conversion the seller was never
 * shown — the whole point of previewing first. Case is normalised because a
 * currency is three letters and "eur" is the same currency as "EUR".
 */
export function previewMatches(
  preview: CurrencyChangePreview | null,
  toCurrency: string,
  rate: string,
): boolean {
  if (preview === null) return false;
  return preview.toCurrency === toCurrency.trim().toUpperCase() && preview.rate === rate.trim();
}

/** `market/competitors.json#C-001.price` → `C-001.price`, the field the seller recognises. */
function fieldOf(key: string): string {
  return key.slice(key.indexOf("#") + 1);
}

export function CurrencyChangePanel({
  currency,
  toCurrency,
  rate,
  preview,
  isPreviewing,
  isApplying,
  error,
  onCurrencyChange,
  onRateChange,
  onPreview,
  onApply,
  onRetry,
}: CurrencyChangePanelProps) {
  const confirmed = previewMatches(preview, toCurrency, rate);
  const rows = preview === null ? [] : Object.keys(preview.newValues);

  return (
    <section className="om-card" aria-label="Change currency">
      <p className="om-eyebrow">Change currency</p>
      <p className="om-section-sub">
        Restate every amount in this project in another currency, at a rate you enter. Percentages
        stay percentages — only amounts move.
      </p>

      <div className="currency-change__inputs">
        <Field hint="Three letters, e.g. USD" label={`From ${currency}`}>
          <input
            className="om-input"
            disabled
            maxLength={3}
            readOnly
            value={currency}
          />
        </Field>
        <Field hint="1 unit of the old currency, in the new one" label="To currency">
          <input
            className="om-input om-money"
            inputMode="decimal"
            maxLength={3}
            onChange={(event) => onCurrencyChange(event.target.value)}
            placeholder="EUR"
            value={toCurrency}
          />
        </Field>
        <Field hint="For example 0.011 for INR → EUR" label="Rate">
          <input
            className="om-input om-money"
            inputMode="decimal"
            onChange={(event) => onRateChange(event.target.value)}
            placeholder="0.011"
            value={rate}
          />
        </Field>
      </div>

      <div className="currency-change__actions">
        <Button
          disabled={isPreviewing || isApplying}
          onClick={onPreview}
          variant="secondary"
        >
          {isPreviewing ? "Reading project…" : "Preview change"}
        </Button>
        <Button
          disabled={!confirmed || isPreviewing || isApplying}
          onClick={onApply}
          variant="danger"
        >
          {isApplying ? "Changing currency…" : "Confirm change"}
        </Button>
      </div>

      {error ? <ErrorState error={error} onRetry={onRetry} /> : null}

      <p className="om-field__hint">
        This cannot be undone from the app. The only way back is the rate in reverse, and the run
        log holds the exact rate used — so keep the project folder, not just this app, as the record.
      </p>

      {preview !== null ? (
        <>
          <p className="om-badge om-badge--danger" role="status">
            {preview.changedCount === 0
              ? `This project has no amounts to convert — only its currency changes to ${preview.toCurrency}.`
              : `${preview.changedCount} value${preview.changedCount === 1 ? "" : "s"} change from ${preview.fromCurrency} to ${preview.toCurrency} at ${preview.rate}.`}
          </p>

          <p className="om-field__hint">
            Market snapshots are restated at the same rate, so your price history and the margin
            monitor keep comparing like with like. Every old and new value is recorded in the run
            log, and the change can be reversed by running the rate back.
          </p>

          {rows.length > 0 ? (
            <div className="om-diff">
              {rows.slice(0, DIFF_ROWS).map((key) => (
                <div className="om-diff__row" key={key}>
                  <span className="om-diff__field">{fieldOf(key)}</span>
                  <span className="om-diff__before">
                    {preview.oldValues[key]} {currency}
                  </span>
                  <span aria-hidden="true" className="om-diff__arrow">
                    →
                  </span>
                  <span className="om-diff__after">
                    {preview.newValues[key]} {preview.toCurrency}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {rows.length > DIFF_ROWS ? (
            <p className="om-field__hint">
              Showing the first {DIFF_ROWS} of {rows.length} changed values. The run log will
              carry all {rows.length}.
            </p>
          ) : null}

          <p className="om-field__hint">
            Writes {preview.affectedArtifacts.length} file
            {preview.affectedArtifacts.length === 1 ? "" : "s"}:{" "}
            {preview.affectedArtifacts.map((artifact) => artifact.path).join(", ")}.
          </p>
        </>
      ) : (
        <p className="om-field__hint">
          Nothing is written until you preview a change and confirm it.
        </p>
      )}
    </section>
  );
}
