import { REGIONS, type RegionCode } from "./regions.js";

/**
 * A price as the page writes it, in pieces: a real storefront styles the
 * whole number, the decimals and the currency separately, so they are three
 * adjacent elements whose text only reads as a price when put together.
 */
export type PriceParts = { lead: string; whole: string; fraction: string; trail: string };

/** Euro cents converted to the region's currency, in that currency's cents. */
export function convertCents(euroCents: number, region: RegionCode): number {
  return Math.round(euroCents * REGIONS[region].perEuro);
}

export function priceParts(euroCents: number, region: RegionCode): PriceParts {
  const cents = convertCents(euroCents, region);
  const currency = REGIONS[region].currency;
  const units = Math.floor(Math.abs(cents) / 100);
  const decimals = String(Math.abs(cents) % 100).padStart(2, "0");
  const sign = cents < 0 ? "-" : "";
  if (currency === "EUR") return { lead: sign, whole: grouped(units, "."), fraction: `,${decimals}`, trail: " €" };
  return { lead: `${sign}${currency === "GBP" ? "£" : "US $"}`, whole: grouped(units, ","), fraction: `.${decimals}`, trail: "" };
}

/** The whole price as one string: "1.234,56 €", "£19.77", "US $25.06". */
export function formatMoney(euroCents: number, region: RegionCode): string {
  const { lead, whole, fraction, trail } = priceParts(euroCents, region);
  return `${lead}${whole}${fraction}${trail}`;
}

/** Reads what a buyer typed into a price box -- "25", "25,50", "25.5" -- as euro cents, or `null` for nothing usable. */
export function parseTypedPrice(text: string | null, region: RegionCode): number | null {
  if (text === null) return null;
  const cleaned = text.trim().replace(/[^0-9.,]/gu, "").replace(",", ".");
  if (cleaned === "" || !/^\d+(?:\.\d{0,2})?$/u.test(cleaned)) return null;
  return Math.round((Number(cleaned) * 100) / REGIONS[region].perEuro);
}

function grouped(units: number, separator: string): string {
  return String(units).replace(/\B(?=(\d{3})+(?!\d))/gu, separator);
}
