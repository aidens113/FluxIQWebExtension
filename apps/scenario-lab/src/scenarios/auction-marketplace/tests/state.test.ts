import assert from "node:assert/strict";
import test from "node:test";
import { listingByHandle } from "../catalog/index.js";
import { applyAuctionMutation, createAuctionState } from "../state.js";
import type { AuctionState } from "../types.js";

const at = (state: AuctionState, operation: string, payload: unknown, now: number) => applyAuctionMutation(state, operation, payload, now);
const m7 = listingByHandle("m7").id;

test("a new session is the same every time and arming a rendering starts a new one", () => {
  const fresh = createAuctionState();
  assert.deepEqual(fresh, createAuctionState());
  const touched = at(at(fresh, "consent", { choice: "accepted" }, 0), "toggle-watch", { itemId: listingByHandle("m1").id }, 0);
  const armed = at(touched, "set-mode", { mode: "grid-view" }, 0);
  assert.deepEqual(armed, { ...createAuctionState(), mode: "grid-view" });
  assert.equal(at(fresh, "set-mode", { mode: "nonsense" }, 0), fresh);
  assert.equal(at(fresh, "no-such-operation", {}, 0), fresh);
});

test("the watch limiter refuses a fourth toggle inside five seconds and says how long to wait", () => {
  const handles = ["m1", "m2", "m4", "m6"].map((handle) => listingByHandle(handle).id);
  let state = createAuctionState();
  state = at(state, "toggle-watch", { itemId: handles[0] }, 0);
  state = at(state, "toggle-watch", { itemId: handles[1] }, 1_000);
  state = at(state, "toggle-watch", { itemId: handles[2] }, 2_000);
  const refused = at(state, "toggle-watch", { itemId: handles[3] }, 3_000);
  assert.deepEqual(refused.lastWatch, { itemId: handles[3], outcome: "rate-limited", retryAfter: 2 });
  assert.ok(!refused.watched.includes(handles[3]!));
  const later = at(refused, "toggle-watch", { itemId: handles[3] }, 5_001);
  assert.equal(later.lastWatch?.outcome, "watching");
});

test("pressing the heart of a listing already watched takes it off the watchlist", () => {
  const m3 = listingByHandle("m3").id;
  const state = at(createAuctionState(), "toggle-watch", { itemId: m3 }, 0);
  assert.equal(state.lastWatch?.outcome, "removed");
  assert.ok(!state.watched.includes(m3));
});

test("a bid below the minimum is refused with the minimum; one above the rival's maximum wins one increment over it", () => {
  const low = at(createAuctionState(), "place-bid", { itemId: m7, amount: "79.99", reference: "" }, 0);
  assert.deepEqual(low.lastBid, { itemId: m7, outcome: "below-minimum", message: "Enter £80.00 or more." });
  assert.deepEqual(low.bids, []);
  const won = at(createAuctionState(), "place-bid", { itemId: m7, amount: "£85", reference: "" }, 0);
  assert.deepEqual(won.bids, [{ itemId: m7, maxBid: 8_500, current: 8_400, winning: true }]);
  assert.equal(won.lastBid?.message, "You're the highest bidder. Current bid: £84.00.");
  const lost = at(createAuctionState(), "place-bid", { itemId: m7, amount: "81.00", reference: "" }, 0);
  assert.deepEqual(lost.bids, [{ itemId: m7, maxBid: 8_100, current: 8_200, winning: false }]);
  assert.equal(lost.lastBid?.outcome, "outbid");
});

test("a second bid inside ten seconds of a placed one is refused, and allowed afterwards", () => {
  const first = at(createAuctionState(), "place-bid", { itemId: m7, amount: "85.00", reference: "" }, 0);
  const again = at(first, "place-bid", { itemId: m7, amount: "90.00", reference: "" }, 4_000);
  assert.equal(again.lastBid?.outcome, "rate-limited");
  assert.equal(again.lastBid?.message, "You're bidding too quickly. Try again in 6 seconds.");
  assert.equal(again.bids.length, 1);
  assert.equal(at(again, "place-bid", { itemId: m7, amount: "90.00", reference: "" }, 10_000).bids.length, 2);
});

test("a filled bot trap refuses the bid and every bid and purchase after it", () => {
  const trapped = at(createAuctionState(), "place-bid", { itemId: m7, amount: "85.00", reference: "85.00" }, 0);
  assert.equal(trapped.restricted, true);
  assert.deepEqual(trapped.bids, []);
  assert.equal(trapped.lastBid?.outcome, "restricted");
  const honest = at(trapped, "place-bid", { itemId: m7, amount: "85.00", reference: "" }, 60_000);
  assert.deepEqual(honest.bids, []);
  assert.deepEqual(at(trapped, "buy-now", { itemId: listingByHandle("x4").id, reference: "" }, 0).purchases, []);
});

test("Buy it now needs a chosen variation where the listing has them, and is not offered on a plain auction", () => {
  const halfCase = listingByHandle("a2").id;
  assert.deepEqual(at(createAuctionState(), "buy-now", { itemId: halfCase, reference: "" }, 0).purchases, []);
  assert.deepEqual(at(createAuctionState(), "buy-now", { itemId: halfCase, variation: "Oxblood", reference: "" }, 0).purchases, [halfCase]);
  assert.deepEqual(at(createAuctionState(), "buy-now", { itemId: m7, reference: "" }, 0).purchases, []);
  const hybrid = listingByHandle("m4").id;
  assert.deepEqual(at(createAuctionState(), "buy-now", { itemId: hybrid, reference: "" }, 0).purchases, [hybrid]);
});

test("saving a seller toggles, and a malformed seller is ignored", () => {
  const saved = at(createAuctionState(), "follow-seller", { seller: "tinhorn.film" }, 0);
  assert.deepEqual(saved.followed, ["tinhorn.film"]);
  assert.deepEqual(at(saved, "follow-seller", { seller: "tinhorn.film" }, 0).followed, []);
  assert.equal(at(saved, "follow-seller", { seller: "<script>" }, 0), saved);
});
