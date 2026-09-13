import type { AdminRecord } from "./types.js";

/** Customers the book holds under `short-book`: fewer than one render window. */
export const SHORT_BOOK_SIZE = 12;
/** Customers the baseline book holds. Far more than the list renders at once. */
export const FULL_BOOK_SIZE = 240;

const COMPANY_PREFIXES = [
  "Nordvik", "Calder", "Ashgrove", "Brightsea", "Kestrel", "Marlowe", "Pinehill", "Quarrow",
  "Rothway", "Silverbeck", "Tarnside", "Umberfield", "Vantage", "Westmere", "Yarrow", "Cobblestone",
  "Dunmore", "Everline", "Fenwick", "Glasshill",
] as const;
const COMPANY_SUFFIXES = [
  "Freight", "Labs", "Analytics", "Foods", "Optical", "Textiles",
  "Robotics", "Ceramics", "Logistics", "Studios", "Diagnostics", "Brewing",
] as const;
const GIVEN_NAMES = ["Mara", "Theo", "Priya", "Jonah", "Elena", "Sam", "Aiko", "Rafael", "Nadia", "Owen", "Imani", "Lukas", "Sofia", "Emeka", "Hana", "Dmitri", "Claire"] as const;
const FAMILY_NAMES = ["Quinn", "Lindqvist", "Raman", "Okafor", "Varga", "Whitlock", "Tanaka", "Ortiz", "Bergman", "Haddad", "Nakamura", "Fitzgerald", "Oyelaran", "Kowalski", "Delacroix", "Amari", "Sandoval", "Petrov", "Ibarra"] as const;
const OWNERS = ["Priya Raman", "Jonah Okafor", "Elena Varga", "Sam Whitlock", "Aiko Tanaka"] as const;
const PLANS = ["Starter", "Growth", "Scale", "Enterprise"] as const;
const STATUSES = ["Active", "Trial", "Churn risk", "Closed"] as const;
/** Base monthly recurring revenue per plan, in cents, before the per-account offset. */
const PLAN_BASE_CENTS = [29_00, 249_00, 1_180_00, 4_600_00] as const;
const RENEWAL_BASE_MS = Date.UTC(2026, 5, 1);
const DAY_MS = 86_400_000;

/**
 * The authored account book in list order: 240 customers, every company name
 * unique by construction (each of 20 prefixes paired with each of 12 suffixes).
 * It is the same for every lab seed, because the manifest's expected extraction
 * records are literal text and must not move when a runner reseeds the lab.
 */
export const adminRecords: readonly AdminRecord[] = Array.from({ length: FULL_BOOK_SIZE }, (_unused, index) => buildRecord(index));

/** The records that exist under a variant, in list order. */
export function recordsFor(recordCount: number): readonly AdminRecord[] {
  return recordCount >= adminRecords.length ? adminRecords : adminRecords.slice(0, Math.max(0, recordCount));
}

/** The record with an id, within the book a variant exposes. */
export function findRecord(recordCount: number, id: string): AdminRecord | undefined {
  return recordsFor(recordCount).find((record) => record.id === id);
}

function buildRecord(index: number): AdminRecord {
  const prefix = COMPANY_PREFIXES[index % COMPANY_PREFIXES.length] as string;
  const suffix = COMPANY_SUFFIXES[Math.floor(index / COMPANY_PREFIXES.length)] as string;
  const given = GIVEN_NAMES[mix(index, 1) % GIVEN_NAMES.length] as string;
  const family = FAMILY_NAMES[mix(index, 2) % FAMILY_NAMES.length] as string;
  const planIndex = mix(index, 3) % PLANS.length;
  return {
    id: `CUS-${String(index + 1).padStart(4, "0")}`,
    company: `${prefix} ${suffix}`,
    contact: `${given} ${family}`,
    email: `${given.toLowerCase()}.${family.toLowerCase()}@${prefix.toLowerCase()}-${suffix.toLowerCase()}.example`,
    plan: PLANS[planIndex] as AdminRecord["plan"],
    status: STATUSES[mix(index, 4) % STATUSES.length] as AdminRecord["status"],
    owner: OWNERS[mix(index, 5) % OWNERS.length] as string,
    mrrCents: (PLAN_BASE_CENTS[planIndex] as number) + (mix(index, 6) % 40) * 20_00,
    renewsOn: new Date(RENEWAL_BASE_MS + (mix(index, 7) % 180) * DAY_MS).toISOString().slice(0, 10),
  };
}

/** A stable scramble of a list position. It takes no seed: the book must not move when the lab is reseeded. */
function mix(index: number, salt: number): number {
  let value = (Math.imul(index + 1, 0x9e3779b1) + Math.imul(salt, 0x85ebca6b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}
