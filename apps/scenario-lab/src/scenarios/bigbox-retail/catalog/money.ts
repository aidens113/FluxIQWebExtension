/** Dollars and cents the way a US shelf prints them: "$8.97", "$1,204.50". */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(Math.round(cents));
  const dollars = String(Math.floor(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${sign}$${dollars}.${String(absolute % 100).padStart(2, "0")}`;
}
