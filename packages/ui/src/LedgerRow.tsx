export interface LedgerRowProps {
  readonly label: string;
  readonly value: string;
  readonly tone?: "default" | "brass" | "muted";
}

/**
 * The signature element: a receipt-style row whose dotted leader connects
 * an item to its value. Values are always tabular figures.
 */
export function LedgerRow({ label, value, tone = "default" }: LedgerRowProps) {
  const toneClass =
    tone === "brass" ? " om-ledger__value--brass" : tone === "muted" ? " om-ledger__value--muted" : "";
  return (
    <div className="om-ledger__row">
      <span className="om-ledger__label">{label}</span>
      <span aria-hidden="true" className="om-ledger__leader" />
      <span className={`om-ledger__value${toneClass}`}>{value}</span>
    </div>
  );
}
