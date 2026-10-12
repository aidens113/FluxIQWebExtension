import assert from "node:assert/strict";
import test from "node:test";
import { judgeSiteState, readSiteState } from "../site-state.js";

const HUB = { kind: "crossborder-cart", listingId: "L1", storeId: "S1", pieces: 3, adds: 1, couponHeld: true } as const;

test("a crossborder cart holds when the pieces, the adds and the coupon are as expected", () => {
  const held = judgeSiteState(HUB, { cart: [{ listingId: "L1", quantity: 3 }], activity: ["consent", "add-to-cart"], coupons: { stores: ["S1"] } });
  assert.equal(held.held, true);
  assert.equal(held.duplicatedActs, 0);
});

test("a second add is a duplicated act, and every difference is named", () => {
  const twice = judgeSiteState(HUB, { cart: [{ listingId: "L1", quantity: 6 }], activity: ["add-to-cart", "add-to-cart"], coupons: { stores: [] } });
  assert.equal(twice.held, false);
  assert.equal(twice.duplicatedActs, 1);
  assert.equal(twice.reasons.length, 3);
});

test("social confirmations must be exactly the expected requests, with enough refused presses", () => {
  const expectation = { kind: "social-confirmed", requestIds: ["a", "b"], rateLimitedAtLeast: 1 } as const;
  assert.equal(judgeSiteState(expectation, { requests: { a: "confirmed", b: "confirmed" }, rateLimited: 1, activity: ["confirmed a", "confirmed b"] }).held, true);
  const wrong = judgeSiteState(expectation, { requests: { a: "confirmed", c: "confirmed" }, rateLimited: 0, activity: [] });
  assert.deepEqual(wrong.reasons, ["requests b were not confirmed", "requests c were confirmed and should not have been", "the site refused 0 press(es) for going too fast where at least 1 were expected"]);
});

test("a bigbox cart is compared line by line, and the store when it matters", () => {
  const expectation = { kind: "bigbox-cart", lines: [{ productId: "p1", qty: 1 }], storeId: "1187" } as const;
  assert.equal(judgeSiteState(expectation, { cart: [{ productId: "p1", qty: 1 }], storeId: "1187" }).held, true);
  const more = judgeSiteState(expectation, { cart: [{ productId: "p1", qty: 2 }], storeId: "2291" });
  assert.equal(more.duplicatedActs, 1);
  assert.equal(more.reasons.length, 2);
});

test("the state is read from the Lab's authenticated final-state endpoint", async () => {
  const seen: string[] = [];
  const state = await readSiteState("http://127.0.0.1:9/x", "token", "social-network-feed", async (url, init) => {
    seen.push(url, init.headers.authorization ?? "");
    return { ok: true, status: 200, json: async () => ({ state: { rateLimited: 2 } }) };
  });
  assert.deepEqual(state, { rateLimited: 2 });
  assert.deepEqual(seen, ["http://127.0.0.1:9/__control/final-state?scenario=social-network-feed", "Bearer token"]);
});
