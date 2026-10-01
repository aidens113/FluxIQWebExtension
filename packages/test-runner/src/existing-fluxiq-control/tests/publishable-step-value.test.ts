// The one rule that decides what may travel out of Core's audit detail on a
// decision row. Both readers of a build apply it -- the proposed build's here
// in `existing-fluxiq-control`, the refused build's in
// `flow-lane/creation/build-proposal.ts` -- so what it admits, it admits for
// both, and a test of it is a test of both records.

import assert from "node:assert/strict";
import test from "node:test";
import { publishableStepFields, publishableStepValue } from "../publishable-step-value.js";

test("refusal diagnostics retain only the domain's screened structural account", () => {
  const diagnostic = { schemaVersion: "web-build-refusal.v1", phase: "before_action", code: "blocked_by_dialog", pageObserved: true, target: "t1", targetObserved: true, coveringTargets: ["t2"], coveringKinds: ["consent"], coveringCount: 1 };
  assert.deepEqual(publishableStepFields({ diagnostic }).diagnostic, diagnostic);
  for (const malicious of [{ ...diagnostic, label: "Private customer" }, { ...diagnostic, code: "synthetic_secret" }, { ...diagnostic, reason: "synthetic_secret" }, { ...diagnostic, target: "https://private.test/account" }, { ...diagnostic, coveringKinds: ["synthetic_secret"] }]) {
    assert.equal(publishableStepFields({ diagnostic: malicious }).diagnostic, undefined);
  }
});

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

test("bounded draft progress records, including stable build-local id lists, travel", () => {
  assert.deepEqual(publishableStepFields({
    toolId: "core.decision_amend_draft",
    progress: { draftRevisionBefore: 2, draftRevisionAfter: 3, pageState: "unchanged", draftState: "changed", answerabilityState: "changed" },
    draftChange: { targetedStepIds: ["f1", "d2"], appliedCount: 1, refusedCount: 1, keptStepCount: 2, rerunStepId: "d2" },
    draft: { bytes: 2_048, budget: 8_192, steps: 2, instructionBytes: 384, unlisted: 1, withoutInput: 1, inputTooLarge: 0 },
    answerability: { recordsRequested: true, recordProducerPresent: false, recordStorePresent: true, issueCode: "bootstrap.cannot_answer_instruction" },
  }), {
    progress: { draftRevisionBefore: 2, draftRevisionAfter: 3, pageState: "unchanged", draftState: "changed", answerabilityState: "changed" },
    draftChange: { targetedStepIds: ["f1", "d2"], appliedCount: 1, refusedCount: 1, keptStepCount: 2, rerunStepId: "d2" },
    draft: { bytes: 2_048, budget: 8_192, steps: 2, instructionBytes: 384, unlisted: 1, withoutInput: 1, inputTooLarge: 0 },
    answerability: { recordsRequested: true, recordProducerPresent: false, recordStorePresent: true, issueCode: "bootstrap.cannot_answer_instruction" },
  });
});

test("draft progress cannot carry prose, page data, selectors, addresses, digests or nested content", () => {
  const screened = publishableStepFields({
    progress: { pageState: "private page changed", selector: "[data-testid=card]", nested: { value: "web.secret" } },
    draftChange: { targetedStepIds: ["d1", "private product name"], contentHash: `sha256:${"a".repeat(64)}`, url: "http://127.0.0.1/private" },
    answerability: { issueCode: "bootstrap.cannot_answer_instruction", explanation: "The page has a private value" },
  });
  assert.deepEqual(screened, {});
  const serialized = JSON.stringify(screened);
  for (const forbidden of ["private page", "data-testid", "private product", "sha256", "127.0.0.1", "private value"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("draft target ids are string-only, unique, bounded, and atomic", () => {
  const change = (targetedStepIds: readonly unknown[]) => publishableStepFields({
    draftChange: { targetedStepIds, appliedCount: 1, refusedCount: 0, keptStepCount: 2, rerunStepId: "d2" },
  });
  const sixteen = Array.from({ length: 16 }, (_, index) => `d${index + 1}`);

  assert.deepEqual(change(sixteen), { draftChange: { targetedStepIds: sixteen, appliedCount: 1, refusedCount: 0, keptStepCount: 2, rerunStepId: "d2" } });
  for (const malformed of [
    [...sixteen, "d17"],
    ["d1", 2],
    ["d1", true],
    ["d1", "d1"],
    ["d1", "private product name"],
    ["d1", `sha256:${"a".repeat(64)}`],
    ["d1", "x".repeat(201)],
    ["d1", "[data-testid=card]"],
    ["d1", ["d2"]],
  ]) assert.deepEqual(change(malformed), {}, JSON.stringify(malformed));
});

test("nested lists are admitted only for the named draft-target path", () => {
  assert.equal(publishableStepValue({ values: ["d1", "d2"] }), undefined);
  assert.deepEqual(publishableStepFields({ arbitrary: { count: 2, values: ["d1"] } }), { arbitrary: { count: 2 } });
  // Shape screening cannot prove provenance: code-shaped page values and
  // digest-like strings remain generic scalars. Core must not mint ids from
  // them, while this boundary prevents them gaining a new nested-list channel.
  assert.deepEqual(publishableStepFields({ arbitrary: {
    pageValue: "private_product", hostnameLike: "catalog.example", selectorLike: "data-testid",
    uuidLike: "550e8400-e29b-41d4-a716-446655440000", nonHexDigest: "blake3.not-a-digest",
  } }), {
    arbitrary: {
      pageValue: "private_product", hostnameLike: "catalog.example", selectorLike: "data-testid",
      uuidLike: "550e8400-e29b-41d4-a716-446655440000", nonHexDigest: "blake3.not-a-digest",
    },
  });
});

test("named progress records are all-or-nothing closed runtime shapes", () => {
  const valid = {
    progress: { draftRevisionBefore: 2, draftRevisionAfter: 3, pageState: "unchanged", draftState: "changed", answerabilityState: "first_observed" },
    answerability: { recordsRequested: true, recordProducerPresent: false, recordStorePresent: true, issueCode: "bootstrap.cannot_answer_instruction" },
  };
  assert.deepEqual(publishableStepFields(valid), valid);
  assert.deepEqual(publishableStepFields({ progress: { ...valid.progress, pageState: "private_value" } }), {});
  assert.deepEqual(publishableStepFields({ answerability: { ...valid.answerability, issueCode: "bootstrap.made_up" } }), {});
  assert.deepEqual(publishableStepFields({ draft: { bytes: 1, budget: 2, steps: 1, instructionBytes: 1, overBudget: false } }), {});
});

test("unrelated legacy scalars and top-level scalar lists keep their prior behavior", () => {
  assert.deepEqual(publishableStepFields({ iteration: 2, effectApplied: true, resultCode: "web.action.succeeded", issueCodes: ["web.handle.unknown", "unsafe prose"] }), {
    iteration: 2,
    effectApplied: true,
    resultCode: "web.action.succeeded",
    issueCodes: ["web.handle.unknown"],
  });
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

test("an amendment's refusals travel with their reasons and nodes, as records and as flat codes", () => {
  const longNode = `web.${"n".repeat(150)}`;
  assert.deepEqual(publishableStepFields({
    amended: 1,
    amendmentsRefused: [{ step: 9, reason: "no_such_step" }, { step: 2, reason: "already_so", nodeId: longNode }],
    amendmentRefusals: ["9:no_such_step", `2:already_so:${longNode}`],
  }), {
    amended: 1,
    amendmentsRefused: [{ step: 9, reason: "no_such_step" }, { step: 2, reason: "already_so", nodeId: longNode }],
    amendmentRefusals: ["9:no_such_step", `2:already_so:${longNode}`],
  });
});

// Core's closed set, in full (lane t195): four of these reasons were missing
// here, as later were changes_nothing, act_on_a_read and act_already_named
// (t195-w22b), and a step that reported any of them lost its whole refusal list.
test("every reason Core's draft refuses an amendment with travels", () => {
  for (const reason of ["no_such_step", "already_so", "no_such_position", "run_by_the_loop", "no_step_before_it", "over_not_before", "not_a_kept_step", "did_not_work", "already_in_flow", "already_out", "changes_nothing", "act_on_a_read", "act_already_named"]) {
    assert.deepEqual(publishableStepFields({ amendmentsRefused: [{ step: 3, reason }], amendmentRefusals: [`3:${reason}`] }), { amendmentsRefused: [{ step: 3, reason }], amendmentRefusals: [`3:${reason}`] }, reason);
  }
});

test("a refusal list holding anything but positions, closed reasons and node ids is refused whole", () => {
  const refused = (amendmentsRefused: unknown, amendmentRefusals: unknown) => publishableStepFields({ amendmentsRefused, amendmentRefusals });
  assert.deepEqual(refused([{ step: 1, reason: "made_up" }], ["1:made_up"]), {});
  assert.deepEqual(refused([{ step: 1, reason: "already_so", note: "Add to cart" }], ["1:already_so:Add to cart"]), {});
  assert.deepEqual(refused([{ step: 1, reason: "already_so" }, "1:already_so"], ["1:already_so", 1]), {});
  assert.deepEqual(refused([{ step: 10_000, reason: "already_so" }], ["10000:already_so"]), {});
  assert.deepEqual(refused([{ step: 1, reason: "already_so", nodeId: "a".repeat(40) }], [`1:already_so:${"a".repeat(40)}`]), {});
  const many = Array.from({ length: 17 }, (_, index) => ({ step: index + 1, reason: "already_so" }));
  assert.deepEqual(refused(many, many.map((item) => `${item.step}:already_so`)), {});
  assert.deepEqual(refused([], []), {});
});
