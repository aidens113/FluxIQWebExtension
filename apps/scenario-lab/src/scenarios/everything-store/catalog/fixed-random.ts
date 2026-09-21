/**
 * A small deterministic generator (mulberry32) for authoring the catalogue.
 *
 * It is seeded by a constant in each data module, never by the lab seed: the
 * lab seed may differ from run to run, and every expected record in the
 * manifest is computed once, at import, from this data. Only the page's class
 * names and ids follow the lab seed.
 */
export function fixedRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}
