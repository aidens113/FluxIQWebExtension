// The `obstruction` fact (CC7, interface I3): the generic twin of `dialog`,
// answered exactly as `dialog` is -- any open layer whose name contains the
// words -- by the same claim sent to the page, with `dialog` kept as its alias.

import assert from "node:assert/strict";
import test from "node:test";
import type { OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationFactAnswer, WebAutomationFactQuery } from "../../../actions/fact-check";
import { createWebAutomationFactEvaluator, type WebAutomationFactDispatch } from "../evaluate";
import { webAutomationFactQuery } from "../query";

const AT = 1_760_000_000_000;

function asked(condition: unknown): WebAutomationFactQuery {
  const reading = webAutomationFactQuery(condition, {});
  assert.ok("query" in reading, `expected a query, got ${JSON.stringify(reading)}`);
  return reading.query;
}

test("obstruction is asked as dialog is: the same claim, whatever the word", () => {
  for (const op of ["exists", "visible", "absent"] as const) {
    assert.deepEqual(asked({ fact: "obstruction", op }), asked({ fact: "dialog", op }), op);
  }
  assert.deepEqual(asked({ fact: "obstruction", op: "visible" }), { kind: "dialog", expected: true });
  assert.deepEqual(asked({ fact: "obstruction", op: "absent" }), { kind: "dialog", expected: false });
});

test("obstruction takes the layer's name words as dialog does, from the value or a saved target", () => {
  assert.deepEqual(asked({ fact: "obstruction", op: "visible", value: "reading club" }), { kind: "dialog", expected: true, nameContains: "reading club" });
  assert.deepEqual(asked({ fact: "obstruction", op: "contains", value: "Reading club" }), asked({ fact: "dialog", op: "contains", value: "Reading club" }));
  assert.deepEqual(asked({ fact: "obstruction", op: "absent", target: { kind: "obstruction", name: "Reading club" } }), { kind: "dialog", expected: false, nameContains: "Reading club" });
  assert.deepEqual(asked({ fact: "obstruction", op: "absent", target: { kind: "dialog", name: "Reading club" } }), { kind: "dialog", expected: false, nameContains: "Reading club" });
});

test("obstruction.<kind> narrows by the generic kind, as the page-evidence kind it stands for", () => {
  assert.deepEqual(asked({ fact: "obstruction.overlay", op: "visible" }), { kind: "dialog", expected: true, dialogKind: "consent" });
  assert.deepEqual(asked({ fact: "obstruction.notice", op: "absent" }), { kind: "dialog", expected: false, dialogKind: "promotion" });
  assert.deepEqual(asked({ fact: "obstruction.rate_limit", op: "visible" }), { kind: "dialog", expected: true, dialogKind: "rate_limit" });
  assert.deepEqual(asked({ fact: "obstruction.assistant", op: "visible" }), { kind: "dialog", expected: true, dialogKind: "assistant" });
  // `other` names no page-evidence kind, so it narrows nothing.
  assert.deepEqual(asked({ fact: "obstruction.other", op: "visible" }), { kind: "dialog", expected: true });
});

test("obstruction refuses what dialog refuses: a kind that is none, an operator it does not take, a blank name", () => {
  for (const condition of [
    { fact: "obstruction.newsletter", op: "visible" },
    { fact: "obstruction.consent", op: "visible" },
    { fact: "obstruction", op: "equals" },
    { fact: "obstruction", op: "contains" },
    { fact: "obstruction", op: "visible", value: "   " }
  ]) {
    const reading = webAutomationFactQuery(condition, {});
    assert.ok("unknown" in reading, JSON.stringify(condition));
    assert.equal(reading.unknown, "unsupported");
  }
});

test("dialog keeps working beside it", () => {
  assert.deepEqual(asked({ fact: "dialog", op: "visible" }), { kind: "dialog", expected: true });
  assert.deepEqual(asked({ fact: "dialog.rate_limit", op: "exists", value: "slow down" }), { kind: "dialog", expected: true, dialogKind: "rate_limit", nameContains: "slow down" });
});

test("a batch asking obstruction and dialog sends the same query for both and answers both from the page", async () => {
  const sent: JsonObject[] = [];
  const dispatch: WebAutomationFactDispatch = async (request) => {
    sent.push(request.payload);
    const answers: WebAutomationFactAnswer[] = [{ result: "true", capturedAt: AT }, { result: "true", capturedAt: AT }];
    return { outputId: request.outputId, ok: true, status: "succeeded", payload: { status: "succeeded", result: { answers, document: { url: "https://library.test/catalogue", readyState: "complete", timeOrigin: 42 } } as unknown as JsonObject } } as OutputDispatchResult<JsonObject>;
  };
  const results = await createWebAutomationFactEvaluator(dispatch, () => AT)([
    { fact: "obstruction", op: "visible", value: "reading club" },
    { fact: "dialog", op: "visible", value: "reading club" }
  ]);
  const { queries } = sent[0] as { queries: unknown[] };
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[0], queries[1]);
  assert.deepEqual(results.map((result) => result.result), ["true", "true"]);
});
