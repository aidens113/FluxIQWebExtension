import assert from "node:assert/strict";
import test from "node:test";
import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import type { ScenarioFactProbe } from "../../../scenario-assertions.js";
import { assertCreatedFlowOracles, judgeCreatedFlowOracles, judgeEveryFact, withholdObservedFactValues, type CreatedFlowOracles } from "../oracles.js";

// run-murwd8le-79e735a8 (Cause 13): the playback goal held, and the record kept
// only `finalState: "held"`, so a debug could not say what the cart line or the
// coupon wallet actually read. Every fact is now recorded, held or not.

function probe(texts: Record<string, string>, pathname = "/cart"): ScenarioFactProbe {
  return {
    text: async subject => texts[subject] ?? null,
    visible: async subject => subject in texts,
    exists: async subject => subject in texts,
    enabled: async subject => subject in texts,
    path: async () => pathname,
    iframeCount: async () => 0,
    labelCount: async () => 0,
  };
}

const facts: ExpectedFact[] = [
  { id: "cart-line", subject: "mini-cart-line", predicate: "text", value: "Voltbay hub x3" },
  { id: "on-cart", subject: "page", predicate: "path", value: "/cart" },
  { id: "coupons-held", subject: "coupon-wallet", predicate: "contains", value: "OFFICIAL5" },
  { id: "badge-shown", subject: "cart-badge", predicate: "visible", value: true },
];

test("every fact is judged with its subject, expected and observed value, held or not", async () => {
  assert.deepEqual(await judgeEveryFact(facts, probe({ "mini-cart-line": " Voltbay hub x3 ", "coupon-wallet": "no coupons" })), [
    { factId: "cart-line", subject: "mini-cart-line", predicate: "text", expected: "Voltbay hub x3", observed: "Voltbay hub x3", held: true },
    { factId: "on-cart", subject: "page", predicate: "path", expected: "/cart", observed: "/cart", held: true },
    { factId: "coupons-held", subject: "coupon-wallet", predicate: "contains", expected: "OFFICIAL5", observed: "no coupons", held: false },
    { factId: "badge-shown", subject: "cart-badge", predicate: "visible", expected: true, observed: false, held: false },
  ]);
});

test("a fact the fixture declares wrongly still throws rather than reading as unheld", async () => {
  await assert.rejects(judgeEveryFact([{ id: "bad", subject: "x", predicate: "visible", value: "yes" }], probe({})),
    (error: unknown) => error instanceof RunnerFailure && /requires a boolean value/u.test(error.message));
});

test("a final state that held keeps every fact's observed value in the oracles", async () => {
  const judged = await judgeEveryFact(facts.slice(0, 3), probe({ "mini-cart-line": "Voltbay hub x3", "coupon-wallet": "OFFICIAL5 collected" }));
  const oracles = await judgeCreatedFlowOracles({ extraction: null, declaresFinalState: true, judgeFinalState: async () => ({ held: true, unheldFacts: [], facts: judged }) });
  assert.deepEqual(oracles, { records: "not_declared", finalState: "held", facts: judged });
  assert.equal(oracles.facts?.find(fact => fact.factId === "coupons-held")?.observed, "OFFICIAL5 collected");
});

test("a verdict that read no facts records none, as before", async () => {
  assert.deepEqual(await judgeCreatedFlowOracles({ extraction: null, declaresFinalState: true, judgeFinalState: async () => ({ held: true, unheldFacts: [] }) }), { records: "not_declared", finalState: "held" });
});

test("a scenario that declares a secret withholds every observed value, held facts included", () => {
  const oracles: CreatedFlowOracles = {
    records: "not_declared", finalState: "failed",
    unheldFacts: [{ factId: "a", subject: "s", predicate: "text", expected: "x", observed: "PAGE-TEXT-A" }],
    facts: [
      { factId: "a", subject: "s", predicate: "text", expected: "x", observed: "PAGE-TEXT-A", held: false },
      { factId: "b", subject: "t", predicate: "text", expected: "y", observed: "PAGE-TEXT-B", held: true },
    ],
  };
  const screened = withholdObservedFactValues(oracles);
  assert.equal(JSON.stringify(screened).includes("PAGE-TEXT"), false);
  assert.deepEqual(screened.facts?.map(fact => [fact.factId, fact.held, fact.observed]), [["a", false, "[withheld: the scenario declares a secret]"], ["b", true, "[withheld: the scenario declares a secret]"]]);
  assert.deepEqual(withholdObservedFactValues({ records: "held", finalState: "held" }), { records: "held", finalState: "held" });
});

test("a failure's details carry the unheld facts as before, and never the held facts' page text", () => {
  const oracles: CreatedFlowOracles = {
    records: "not_declared", finalState: "failed",
    unheldFacts: [{ factId: "a", subject: "s", predicate: "text", expected: "x", observed: "missed" }],
    facts: [
      { factId: "a", subject: "s", predicate: "text", expected: "x", observed: "missed", held: false },
      { factId: "b", subject: "t", predicate: "text", expected: "y", observed: "HELD-PAGE-TEXT", held: true },
    ],
  };
  assert.throws(() => assertCreatedFlowOracles(null, oracles), (error: unknown) => error instanceof RunnerFailure
    && JSON.stringify(error.details?.oracles) === JSON.stringify({ records: "not_declared", finalState: "failed", unheldFacts: oracles.unheldFacts }));
});
