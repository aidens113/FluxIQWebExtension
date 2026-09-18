import { companyBands } from "./companies.js";

/** One choice in the size filter: the value the control carries, the words the page shows, and the band an entry must hold. */
export type CompanySizeOption = { value: string; label: string; band?: string };

/** The letters the A-Z index offers, whether or not the register has an entry under each. */
export const COMPANY_LETTERS: readonly string[] = Array.from({ length: 26 }, (_unused, index) => String.fromCharCode(65 + index));

/**
 * The size filter, largest last. A value is the band with its punctuation
 * removed, because a query string carries it; the band itself keeps the en
 * dash and the thousands separator the page prints.
 */
export const COMPANY_SIZE_OPTIONS: readonly CompanySizeOption[] = [
  { value: "", label: "Any size" },
  ...companyBands.map((band) => ({ value: sizeValue(band), label: `${band} employees`, band })),
];

/** The query-string value for a headcount band: the comma is dropped, the plus sign becomes "-plus", and the en dash becomes a hyphen. */
export function sizeValue(band: string): string {
  return band.replaceAll(",", "").replace("+", "-plus").replaceAll("\u2013", "-");
}
