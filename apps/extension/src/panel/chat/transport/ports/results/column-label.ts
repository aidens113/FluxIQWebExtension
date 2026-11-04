/** A stored field id in plain words: `unit_price` and `unitPrice` both read "Unit price". Never a selector. */
export function columnLabel(id: string): string {
  const words = id.replace(/([a-z0-9])([A-Z])/gu, "$1 $2").replace(/[_-]+/gu, " ").trim().toLowerCase();
  return words === "" ? id : words.charAt(0).toUpperCase() + words.slice(1);
}
