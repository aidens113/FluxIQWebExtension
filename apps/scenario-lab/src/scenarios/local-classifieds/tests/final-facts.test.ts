import assert from "node:assert/strict";
import test from "node:test";
import { listingByKey } from "../catalog/index.js";
import { localClassifiedsScenario as scenario } from "../scenario.js";
import { createClassifiedsState, mutateClassifiedsState } from "../state.js";
import { accountContactsFacts, TEST_RIDE_LISTING_KEY } from "../breadth/index.js";
import { OFFER_AMOUNT, OFFER_LISTING_KEY } from "../targets.js";

/** The offer task is judged by the account element every page carries, not by the listing's own receipt. */
const offerFact = () => scenario.manifest.playbackGoal!.successFacts.find(({ id }) => id === "offer-only-to-folding-bike")!;
const listing = (key: string) => listingByKey(key).id;
const offer = (state = createClassifiedsState(), listingId = listing(OFFER_LISTING_KEY), amount = OFFER_AMOUNT, now = 0) => mutateClassifiedsState(state, "send-offer", { listingId, amount }, now);

test("make-offer: the account element holds exactly the one offer, in the goal and in the final state", () => {
  const fact = offerFact();
  assert.equal(fact.subject, "classifieds-account-contacts");
  assert.ok(scenario.manifest.expected?.finalState?.some(({ id }) => id === fact.id));
  assert.equal(accountContactsFacts(offer()), fact.value);
});

test("make-offer: a wrong or extra contact reads differently", () => {
  const value = offerFact().value;
  const other = listingByKey(TEST_RIDE_LISTING_KEY);
  assert.notEqual(accountContactsFacts(createClassifiedsState()), value, "no offer");
  assert.notEqual(accountContactsFacts(offer(undefined, undefined, OFFER_AMOUNT + 10)), value, "another amount");
  assert.notEqual(accountContactsFacts(offer(offer(), undefined, OFFER_AMOUNT, 10_000_000)), value, "the offer sent twice");
  const messaged = mutateClassifiedsState(offer(), "send-message", { listingId: other.id, text: "Hi, is this still available?" }, 10_000_000);
  assert.notEqual(accountContactsFacts(messaged), value, "the ready-made message sent too");
  assert.notEqual(accountContactsFacts(mutateClassifiedsState(createClassifiedsState(), "send-offer", { listingId: other.id, amount: OFFER_AMOUNT }, 0)), value, "another listing");
});
