// What the site itself says happened, read from the Scenario Lab's state
// endpoint after the run: the acts that landed, counted.
//
// A run's trace says what FluxIQ did; the site's state says what it received.
// A duplicated act (an item added twice, a request confirmed after a lost
// acknowledgement and then again) shows here and nowhere else, so every case's
// verdict reads it. Only counts and ids leave this module.

import { RunnerFailure } from "../../failure.js";
import type { RecoverySiteExpectation } from "../matrix-row.js";

/** What the site's state came to against the case's expectation. */
export type SiteReading = Readonly<{
  held: boolean;
  /** Why it did not hold, in closed sentences naming counts and ids; empty when it held. */
  reasons: readonly string[];
  /** Acts the site received beyond the expectation: an add or confirm more than once. */
  duplicatedActs: number;
  observed: Readonly<Record<string, number | boolean | string | readonly string[] | null>>;
}>;

export type SiteStateFetch = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** The scenario's state, as `/__control/final-state?scenario=` answers it. */
export async function readSiteState(origin: string, runToken: string, scenarioId: string, fetchLab: SiteStateFetch = fetch): Promise<Record<string, unknown>> {
  const response = await fetchLab(`${new URL(origin).origin}/__control/final-state?scenario=${encodeURIComponent(scenarioId)}`, { headers: { authorization: `Bearer ${runToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new RunnerFailure("fixture.invalid", `The Scenario Lab did not answer the site's state (${response.status})`);
  const snapshot = record(await response.json());
  const state = snapshot && record(snapshot.state);
  if (!state) throw new RunnerFailure("fixture.invalid", "The Scenario Lab's state answer carried no state");
  return state;
}

/** The site's state judged against what the case expects it to show. */
export function judgeSiteState(expectation: RecoverySiteExpectation, state: Readonly<Record<string, unknown>>): SiteReading {
  if (expectation.kind === "crossborder-cart") return crossborderCart(expectation, state);
  if (expectation.kind === "social-confirmed") return socialConfirmed(expectation, state);
  return bigboxCart(expectation, state);
}

function crossborderCart(expectation: Extract<RecoverySiteExpectation, { kind: "crossborder-cart" }>, state: Readonly<Record<string, unknown>>): SiteReading {
  const lines = list(state.cart).map(record).filter((line): line is Record<string, unknown> => line !== undefined && line.listingId === expectation.listingId);
  const pieces = lines.reduce((sum, line) => sum + (typeof line.quantity === "number" ? line.quantity : 0), 0);
  const adds = list(state.activity).filter(operation => operation === "add-to-cart").length;
  const coupons = record(state.coupons);
  const couponHeld = list(coupons?.stores).includes(expectation.storeId);
  const reasons: string[] = [];
  if (pieces !== expectation.pieces) reasons.push(`the cart holds ${pieces} of the listing where ${expectation.pieces} were expected`);
  if (adds !== expectation.adds) reasons.push(`the site received ${adds} add-to-cart act(s) where ${expectation.adds} were expected`);
  if (couponHeld !== expectation.couponHeld) reasons.push(expectation.couponHeld ? "the store's coupon was not collected" : "the store's coupon was collected where it should not have been");
  return { held: reasons.length === 0, reasons, duplicatedActs: Math.max(0, adds - expectation.adds), observed: { pieces, adds, couponHeld, cartLines: lines.length } };
}

function socialConfirmed(expectation: Extract<RecoverySiteExpectation, { kind: "social-confirmed" }>, state: Readonly<Record<string, unknown>>): SiteReading {
  const answers = record(state.requests) ?? {};
  const confirmed = Object.keys(answers).filter(id => answers[id] === "confirmed").sort();
  const confirmations = list(state.activity).filter(entry => typeof entry === "string" && entry.startsWith("confirmed ")).length;
  const rateLimited = typeof state.rateLimited === "number" ? state.rateLimited : 0;
  const expected = [...expectation.requestIds].sort();
  const reasons: string[] = [];
  const missing = expected.filter(id => !confirmed.includes(id));
  const extra = confirmed.filter(id => !expected.includes(id));
  if (missing.length) reasons.push(`requests ${missing.join(", ")} were not confirmed`);
  if (extra.length) reasons.push(`requests ${extra.join(", ")} were confirmed and should not have been`);
  if (rateLimited < expectation.rateLimitedAtLeast) reasons.push(`the site refused ${rateLimited} press(es) for going too fast where at least ${expectation.rateLimitedAtLeast} were expected`);
  return { held: reasons.length === 0, reasons, duplicatedActs: Math.max(0, confirmations - confirmed.length), observed: { confirmed, rateLimited, confirmations } };
}

function bigboxCart(expectation: Extract<RecoverySiteExpectation, { kind: "bigbox-cart" }>, state: Readonly<Record<string, unknown>>): SiteReading {
  const lines = list(state.cart).map(record).filter((line): line is Record<string, unknown> => line !== undefined);
  const observed = lines.map(line => `${String(line.productId)}x${String(line.qty)}`).sort();
  const expected = expectation.lines.map(line => `${line.productId}x${line.qty}`).sort();
  const reasons: string[] = [];
  if (observed.join(",") !== expected.join(",")) reasons.push(`the cart holds ${observed.join(", ") || "nothing"} where ${expected.join(", ") || "nothing"} was expected`);
  if (expectation.storeId !== null && state.storeId !== expectation.storeId) reasons.push(`the shopper's store is ${String(state.storeId)}, not ${expectation.storeId}`);
  const surplus = lines.reduce((sum, line) => {
    const wanted = expectation.lines.find(item => item.productId === line.productId);
    return sum + (wanted && typeof line.qty === "number" ? Math.max(0, line.qty - wanted.qty) : 0);
  }, 0);
  return { held: reasons.length === 0, reasons, duplicatedActs: surplus, observed: { lines: observed, storeId: typeof state.storeId === "string" ? state.storeId : null } };
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
