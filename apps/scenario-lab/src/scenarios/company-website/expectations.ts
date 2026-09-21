import { branchById, COMPANY, longDate, PRICE_LIST, priceText, referenceCode, slotsFor, TEAM, weekday } from "./data/index.js";
import { normaliseQuote } from "./state.js";
import type { QuoteRequest } from "./types.js";

/**
 * Every answer the manifest and the live tasks state, derived from the same
 * data the pages render, so the oracle and the site cannot drift apart. Each
 * is what an honest, careful person arrives at by reading the site.
 */

/** The quote request the primary workflow and its task ask for, as the visitor would enter it. */
export const QUOTE_INPUT = {
  fullName: "Ada Synthetic",
  email: "ada.synthetic@example.test",
  phone: "07700 900123",
  postcode: "KL6 2RN",
  service: "Combi boiler replacement",
  contactBy: "Email",
  marketing: false,
  details: "The current boiler is a 2009 floor-standing model in the kitchen.",
} as const;

/** The request as the server stores it, reference included. The reference depends on every structured field and on no free text. */
export const EXPECTED_QUOTE: QuoteRequest = (() => {
  const request = normaliseQuote({ ...QUOTE_INPUT, privacy: true });
  if (!request) throw new Error("The authored quote request does not validate");
  return request;
})();

const GAS_SAFE_BRANCHES = ["eastmoor", "hollins-cross"] as const;

/**
 * Everyone at Eastmoor or Hollins Cross who holds a Gas Safe ID, once each,
 * in the order "Everyone" lists them. Not the job advert, whose Gas Safe line
 * reads "Required"; not the apprentices, whose line reads "Registration
 * pending"; and the Technical Director once, although he is also in the
 * leadership strip.
 */
export const GAS_ENGINEER_RECORDS: ReadonlyArray<Record<string, string>> = TEAM
  .filter((card) => card.kind === "person" && (GAS_SAFE_BRANCHES as readonly string[]).includes(card.branchId))
  .flatMap((card) => {
    const id = card.credentials.find(({ label, value }) => label === "Gas Safe ID" && /^\d+$/u.test(value));
    return id ? [{ name: card.name, role: card.role, branch: branchById(card.branchId).name, gasSafeId: id.value }] : [];
  });

const PRICE_CATEGORIES = ["servicing", "repairs"] as const;

/** The landlord and business prices, excluding VAT, of every service in the first two categories, partner adverts left out, in page order. */
export const PRICE_LIST_RECORDS: ReadonlyArray<Record<string, string>> = PRICE_LIST
  .filter(({ id }) => (PRICE_CATEGORIES as readonly string[]).includes(id))
  .flatMap(({ rows }) => rows.filter((entry) => !entry.partner).map((entry) => ({ service: entry.name, price: priceText(entry, "ex") })));

/** The booking the consequential task asks for: a combi service at Hollins Cross. */
export const BOOKING_INPUT = { branchId: "hollins-cross", serviceId: "service-combi", onOrAfter: "2026-10-01" } as const;

/**
 * The earliest free weekday slot before noon on or after 1 October at
 * Hollins Cross -- Monday 5 October at 10:30 -- and the confirmation the site
 * shows for it once the deposit is paid.
 */
export const BOOKING_RECORD: Readonly<Record<string, string>> = (() => {
  const slot = slotsFor(BOOKING_INPUT.branchId).find(({ date, time, free }) => free && date >= BOOKING_INPUT.onOrAfter && weekday(date) >= 1 && weekday(date) <= 5 && time < "12:00");
  if (!slot) throw new Error("The authored calendar has no answer to the booking task");
  return {
    reference: referenceCode("SW", [BOOKING_INPUT.branchId, BOOKING_INPUT.serviceId, slot.date, slot.time]),
    branch: branchById(BOOKING_INPUT.branchId).name,
    date: longDate(slot.date),
    time: slot.time,
    engineer: slot.engineer,
  };
})();

/** Where the pages live, for `path` facts. */
export const SITE_PATHS = { home: COMPANY.root, team: `${COMPANY.root}team`, services: `${COMPANY.root}services` } as const;
