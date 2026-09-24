// The one rule that decides what may travel out of Core's audit detail on a
// decision row. Both readers of a build apply it -- the proposed build's here
// in `existing-fluxiq-control`, the refused build's in
// `flow-lane/creation/build-proposal.ts` -- so what it admits, it admits for
// both, and a test of it is a test of both records.

import assert from "node:assert/strict";
import test from "node:test";
import { publishableStepFields, publishableStepValue } from "../publishable-step-value.js";

test("a count, a flag and a code-shaped string travel", () => {
  assert.equal(publishableStepValue(7), 7);
  assert.equal(publishableStepValue(0), 0);
  assert.equal(publishableStepValue(true), true);
  assert.equal(publishableStepValue(false), false);
  assert.equal(publishableStepValue("web.action.rejected.no_progress"), "web.action.rejected.no_progress");
  assert.equal(publishableStepValue("2026-09-24T11:04:07+00:00"), "2026-09-24T11:04:07+00:00");
});

test("anything that could be a sentence, an address, a selector or a label does not", () => {
  assert.equal(publishableStepValue("Add to cart"), undefined);
  assert.equal(publishableStepValue("http://127.0.0.1:53017/scenarios/catalog"), undefined);
  assert.equal(publishableStepValue('[data-testid="card"]'), undefined);
  assert.equal(publishableStepValue("I will click the Submit button"), undefined);
  // A value long enough to be a page, and one that is not a number at all.
  assert.equal(publishableStepValue("a".repeat(129)), undefined);
  assert.equal(publishableStepValue(Number.NaN), undefined);
  assert.equal(publishableStepValue(null), undefined);
});

test("a list keeps the members that may travel, and is dropped when none may", () => {
  assert.deepEqual(publishableStepValue(["web.inspect", "a label with spaces", 4]), ["web.inspect", 4]);
  assert.equal(publishableStepValue(["a label", "another label"]), undefined);
  assert.equal((publishableStepValue(Array.from({ length: 40 }, (_, index) => index)) as readonly number[]).length, 32);
});

test("a record one level deep travels, which is what Core's per-call usage is", () => {
  assert.deepEqual(publishableStepValue({ inputTokens: 1_200, outputTokens: 300 }), { inputTokens: 1_200, outputTokens: 300 });
});

// A structure deep enough to hold a page is not a member of a decision, so
// nesting stops at one level rather than being walked for publishable leaves.
test("nothing nests further than that", () => {
  assert.equal(publishableStepValue({ input: { selector: "web.thing" } }), undefined);
  assert.equal(publishableStepValue([["web.thing"]]), undefined);
});

test("a row carries its members beside the tool id, which each reader writes itself", () => {
  assert.deepEqual(publishableStepFields({ toolId: "core.run_node", iteration: 2, resultCode: "web.action.succeeded" }), { iteration: 2, resultCode: "web.action.succeeded" });
});

test("a member whose name no producer would write is left behind", () => {
  assert.deepEqual(publishableStepFields({ "a field name": 1, "path.to.thing": 2, kept: 3 }), { kept: 3 });
});

test("a row is bounded, so a record cannot be grown one member at a time", () => {
  const wide = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`field${index}`, index]));

  // 24 members counting the `toolId` its reader writes, so 23 arrive here.
  assert.equal(Object.keys(publishableStepFields(wide)).length, 23);
});
