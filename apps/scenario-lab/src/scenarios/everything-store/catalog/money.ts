/**
 * A price the way a US storefront prints it: dollar sign, thousands
 * separators, always two decimals -- `$1,249.99`.
 */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(Math.round(cents));
  const dollars = Math.floor(absolute / 100).toLocaleString("en-US");
  return `${sign}$${dollars}.${String(absolute % 100).padStart(2, "0")}`;
}
