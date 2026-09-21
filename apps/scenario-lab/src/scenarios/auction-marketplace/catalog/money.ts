import type { Currency, Postage } from "../types.js";

/**
 * Money as the marketplace writes it. A listing is priced in its seller's
 * currency and written in that seller's convention -- a Dutch or German seller
 * writes `EUR 1.165,00`, with a point for thousands and a comma for the
 * decimals -- and the site adds its own pound estimate underneath, from a
 * fixed daily rate. A reader who parses `EUR 1.165,00` as a pound-and-a-bit,
 * or compares `EUR 169,00` with a pound limit, gets the wrong answer.
 */
const RATES_TO_GBP: Readonly<Record<Currency, number>> = { GBP: 1, EUR: 0.8679, USD: 0.7463 };

function grouped(whole: number, separator: string): string {
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/gu, separator);
}

/** An amount in minor units, written in its currency's convention. */
export function moneyText(currency: Currency, minor: number): string {
  const whole = Math.floor(minor / 100);
  const cents = String(minor % 100).padStart(2, "0");
  if (currency === "EUR") return `EUR ${grouped(whole, ".")},${cents}`;
  if (currency === "USD") return `US $${grouped(whole, ",")}.${cents}`;
  return `£${grouped(whole, ",")}.${cents}`;
}

/** The site's pound estimate of an amount, in pence, rounded half up. */
export function poundsEstimate(currency: Currency, minor: number): number {
  return currency === "GBP" ? minor : Math.round(minor * RATES_TO_GBP[currency]);
}

/** The estimate line under a foreign price, or an empty string for a price already in pounds. */
export function approxText(currency: Currency, minor: number): string {
  return currency === "GBP" ? "" : `approx. ${moneyText("GBP", poundsEstimate(currency, minor))}`;
}

/** The postage line of a results card. */
export function postageText(currency: Currency, postage: Postage): string {
  if (postage.kind === "free") return "Free postage";
  if (postage.kind === "collection") return "Collection in person";
  return `+${moneyText(currency, postage.amount)} postage`;
}

/** The estimate line under foreign postage, or an empty string. */
export function postageApproxText(currency: Currency, postage: Postage): string {
  return postage.kind === "paid" ? approxText(currency, postage.amount) : "";
}

/** Postage in pence for the price-plus-postage sort; collection counts as nothing to post. */
export function postagePence(currency: Currency, postage: Postage): number {
  return postage.kind === "paid" ? poundsEstimate(currency, postage.amount) : 0;
}

/**
 * Reads a bid a person typed: `85`, `85.00`, `£85`, `1,085.50`, `85,00`.
 * Returns minor units, or `undefined` for anything that is not an amount.
 */
export function parseTypedAmount(text: string): number | undefined {
  const cleaned = text.replace(/[£$€\s]|EUR|US/giu, "");
  const decimalComma = /^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/u.test(cleaned);
  const normal = decimalComma ? cleaned.replaceAll(".", "").replace(",", ".") : cleaned.replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/u.test(normal)) return undefined;
  const [whole, fraction = ""] = normal.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
