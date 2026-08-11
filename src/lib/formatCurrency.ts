function groupIndianDigits(integer: string) {
  if (integer.length <= 3) return integer;
  const finalGroup = integer.slice(-3);
  const leading = integer.slice(0, -3);
  const groups: string[] = [];
  for (let end = leading.length; end > 0; end -= 2) {
    groups.unshift(leading.slice(Math.max(0, end - 2), end));
  }
  return `${groups.join(",")},${finalGroup}`;
}

function currencySymbol(currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", { currency, currencyDisplay: "symbol", style: "currency" })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? `${currency} `;
  } catch {
    return `${currency} `;
  }
}

export function formatFixedCurrency(value: string, currency: string) {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return `${currency} ${value}`;
  const [, sign, integer, fraction = ""] = match;
  const normalizedFraction = fraction.padEnd(2, "0").slice(0, 2);
  return `${sign === "-" ? "-" : ""}${currencySymbol(currency)}${groupIndianDigits(integer)}.${normalizedFraction}`;
}

export function isNegativeFixedDecimal(value: string) {
  return /^-\d/.test(value.trim());
}
