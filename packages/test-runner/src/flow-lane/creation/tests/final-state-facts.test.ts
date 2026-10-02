import assert from "node:assert/strict";
import test from "node:test";
import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import type { ScenarioFactProbe } from "../../../scenario-assertions.js";
import { judgeExpectedFacts } from "../final-state-facts.js";

/** A page whose subjects read as given: text by subject, and `exists` for any subject with text. */
function probe(texts: Record<string, string>): ScenarioFactProbe {
  return {
    text: async subject => texts[subject] ?? null,
    visible: async subject => subject in texts,
    exists: async subject => subject in texts,
    enabled: async subject => subject in texts,
    path: async () => "/cart",
    iframeCount: async () => 0,
    labelCount: async () => 0,
  };
}

const facts: ExpectedFact[] = [
  { id: "cart-line", subject: "mini-cart-line", predicate: "text", value: "Voltbay hub x3" },
  { id: "on-cart", subject: "page", predicate: "path", value: "/cart" },
  { id: "coupons-held", subject: "coupon-wallet", predicate: "contains", value: "OFFICIAL5" },
];

test("every fact that did not hold is named with its expected and observed value, not only the first", async () => {
  assert.deepEqual(await judgeExpectedFacts(facts, probe({ "coupon-wallet": "no coupons" })), [
    { factId: "cart-line", subject: "mini-cart-line", predicate: "text", expected: "Voltbay hub x3", observed: null },
    { factId: "coupons-held", subject: "coupon-wallet", predicate: "contains", expected: "OFFICIAL5", observed: "no coupons" },
  ]);
});

test("a page where every fact holds names none", async () => {
  assert.deepEqual(await judgeExpectedFacts(facts, probe({ "mini-cart-line": " Voltbay hub x3 ", "coupon-wallet": "OFFICIAL5 held" })), []);
});

test("a fact the fixture declares wrongly is a fixture defect and still throws", async () => {
  await assert.rejects(judgeExpectedFacts([{ id: "bad", subject: "x", predicate: "visible", value: "yes" }], probe({})),
    (error: unknown) => error instanceof RunnerFailure && /requires a boolean value/u.test(error.message));
});
