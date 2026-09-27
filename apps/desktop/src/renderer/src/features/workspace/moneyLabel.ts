/**
 * Field labels for money.
 *
 * The workspace reads the project's currency off the manifest, and that manifest
 * has not arrived yet on the first render. A template literal is honest about
 * what it is, which meant every money field briefly read "Product ()" — and a
 * stray empty pair of brackets in a label reads as a mistake in the app rather
 * than a value that has not loaded.
 */

/**
 * `"Product (INR)"`, or just `"Product"` while the currency is unknown.
 *
 * An empty parenthesised slot is worse than no slot: it looks like the app lost
 * track of something, when in fact it just has not asked yet.
 */
export function moneyLabel(label: string, currency: string): string {
  const code = currency.trim();
  return code === "" ? label : `${label} (${code})`;
}
