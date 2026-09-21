/**
 * A listing's public id, derived from its authored key: sixteen digits that
 * look like a production id, never change with the lab seed, and never
 * depend on where the listing sits in the catalog.
 */
export function listingIdFor(key: string): string {
  const high = BigInt(fnv(`listing:${key}`));
  const low = BigInt(fnv(`photo:${key}`));
  return `10${((high * 4_294_967_296n + low) % 100_000_000_000_000n).toString().padStart(14, "0")}`;
}

/** FNV-1a over the text, as an unsigned 32-bit integer. */
export function fnv(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}
