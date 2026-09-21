import type { ShipOrigin } from "../catalog/index.js";

export const regionCodes = ["DE", "ES", "GB", "US"] as const;
export type RegionCode = (typeof regionCodes)[number];

export type Region = {
  code: RegionCode;
  country: string;
  currency: "EUR" | "GBP" | "USD";
  /** Units of the region's currency per euro, applied to cents and rounded. */
  perEuro: number;
};

/**
 * Where the buyer says they are. The region decides the currency and how a
 * price is written -- "22,99 €" for Germany and Spain, "£19.77" for the United
 * Kingdom, "US $25.06" for the United States -- which is why a price read off
 * this site is only meaningful next to the region it was read in.
 */
export const REGIONS: Readonly<Record<RegionCode, Region>> = {
  DE: { code: "DE", country: "Germany", currency: "EUR", perEuro: 1 },
  ES: { code: "ES", country: "Spain", currency: "EUR", perEuro: 1 },
  GB: { code: "GB", country: "United Kingdom", currency: "GBP", perEuro: 0.86 },
  US: { code: "US", country: "United States", currency: "USD", perEuro: 1.09 },
};

/** Days from the store's fixed "today" (Monday 21 September 2026) to the first and last delivery day, per warehouse. */
const TRANSIT_DAYS: Record<ShipOrigin, readonly [number, number]> = {
  China: [15, 23],
  Spain: [3, 5],
  Poland: [4, 8],
  "Czech Republic": [4, 7],
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const TODAY_UTC = Date.UTC(2026, 8, 21);
const DAY_MS = 86_400_000;

/**
 * The delivery window a warehouse promises, written the way the region writes
 * dates: "24 – 26 Sep" in Europe, "Sep 24 – 26" in the United States, with the
 * month repeated when the window crosses one ("6 Oct – 14 Oct" never occurs;
 * "29 Sep – 3 Oct" does).
 */
export function deliveryWindow(origin: ShipOrigin, region: RegionCode): string {
  const [from, to] = TRANSIT_DAYS[origin];
  const start = new Date(TODAY_UTC + from * DAY_MS);
  const end = new Date(TODAY_UTC + to * DAY_MS);
  const startMonth = MONTHS[start.getUTCMonth()]!;
  const endMonth = MONTHS[end.getUTCMonth()]!;
  const sameMonth = startMonth === endMonth;
  if (region === "US") return sameMonth ? `${startMonth} ${start.getUTCDate()} – ${end.getUTCDate()}` : `${startMonth} ${start.getUTCDate()} – ${endMonth} ${end.getUTCDate()}`;
  return sameMonth ? `${start.getUTCDate()} – ${end.getUTCDate()} ${endMonth}` : `${start.getUTCDate()} ${startMonth} – ${end.getUTCDate()} ${endMonth}`;
}

export function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === "string" && (regionCodes as readonly string[]).includes(value);
}
