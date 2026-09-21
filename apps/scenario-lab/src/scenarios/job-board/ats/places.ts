/** One suggestion of Talentloom's location field: the id the form submits and the label a person reads. */
export type Place = { id: string; label: string };

/**
 * The places Talentloom's location lookup knows, in the order it offers them.
 * The lookup is built for an American market, so for "Bristol" it offers two
 * American Bristols before the English one, and "London" and "Leeds" each have
 * a namesake abroad. A person picks the right one by reading the whole label.
 */
export const PLACES: readonly Place[] = [
  { id: "bristol-ct-us", label: "Bristol, Connecticut, United States" },
  { id: "bristol-tn-us", label: "Bristol, Tennessee, United States" },
  { id: "bristol-england-gb", label: "Bristol, England, United Kingdom" },
  { id: "bristol-va-us", label: "Bristol, Virginia, United States" },
  { id: "bristol-bay-ak-us", label: "Bristol Bay, Alaska, United States" },
  { id: "bristol-pa-us", label: "Bristol, Pennsylvania, United States" },
  { id: "bath-england-gb", label: "Bath, England, United Kingdom" },
  { id: "london-on-ca", label: "London, Ontario, Canada" },
  { id: "london-england-gb", label: "London, England, United Kingdom" },
  { id: "leeds-al-us", label: "Leeds, Alabama, United States" },
  { id: "leeds-england-gb", label: "Leeds, England, United Kingdom" },
  { id: "manchester-nh-us", label: "Manchester, New Hampshire, United States" },
  { id: "manchester-england-gb", label: "Manchester, England, United Kingdom" },
  { id: "cambridge-ma-us", label: "Cambridge, Massachusetts, United States" },
  { id: "cambridge-england-gb", label: "Cambridge, England, United Kingdom" },
  { id: "edinburgh-scotland-gb", label: "Edinburgh, Scotland, United Kingdom" },
  { id: "cardiff-wales-gb", label: "Cardiff, Wales, United Kingdom" },
];

/** What the lookup offers for `query`: every place with a word starting with it, at most six, in its own order. */
export function suggestPlaces(query: string): Place[] {
  const wanted = query.trim().toLowerCase();
  if (wanted.length < 2) return [];
  return PLACES.filter((place) => place.label.toLowerCase().startsWith(wanted) || place.label.toLowerCase().split(/[\s,]+/u).some((word) => word.startsWith(wanted))).slice(0, 6);
}

/** Whether `id` names a place the lookup offers; the form accepts nothing typed freehand. */
export function isKnownPlace(id: string): boolean {
  return PLACES.some((place) => place.id === id);
}
