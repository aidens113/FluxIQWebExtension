import assert from "node:assert/strict";
import test from "node:test";
import { rebuildSubflowCandidate } from "../rebuild-candidate.js";
import type { UnresolvedStep } from "../../types.js";
import { fakeAuthoring, fakeContext } from "./authoring-fakes.js";

const unchanged = { runsNodes: {}, resolvePlanNodeParameters: async () => ({ status: "unchanged" }) };
const refusing = { runsNodes: {}, resolvePlanNodeParameters: async () => ({ status: "refused", issueCodes: ["web.handle.unknown"] }) };
const question = { nodeDefinitionId: "web.output.dom-click", parameters: { target: { handle: "t1" } } };
const authoring = fakeAuthoring({
  same: { questions: [question], subflowDigest: "s10", wholeDigest: "w5" },
  other: { questions: [question], subflowDigest: "s-x", wholeDigest: "w-x" },
  joins: { questions: [], subflowDigest: "s10", wholeDigest: "w5", refuse: "assembly" },
});
const context = fakeContext(authoring, { subflows: [] }, "w8");

test("compares Core's subflow and whole digests of the rebuild with the recorded ones", async () => {
  const same = await rebuildSubflowCandidate(context, { briefId: "brief-1", script: "same", submitStep: 109, recordedSubflow: { revision: 10, digest: "s10" }, recordedWhole: { revision: 5, digest: "w5" }, binding: unchanged });
  assert.deepEqual([same.subflow.rebuiltDigest, same.subflow.matches, same.whole.rebuiltDigest, same.whole.matches, same.refusal], ["s10", true, "w5", true, null]);
  assert.equal(same.candidate?.digest, "w5");
  const other = await rebuildSubflowCandidate(context, { briefId: "brief-1", script: "other", submitStep: 109, recordedSubflow: { revision: 10, digest: "s10" }, recordedWhole: { revision: 5, digest: "w5" }, binding: unchanged });
  assert.deepEqual([other.subflow.matches, other.whole.matches], [false, false]);
  // Nothing recorded to compare with is no match and no mismatch.
  const correction = await rebuildSubflowCandidate(context, { briefId: "brief-1", script: "same", submitStep: null, recordedSubflow: null, recordedWhole: null, binding: unchanged });
  assert.deepEqual([correction.subflow.matches, correction.whole.matches], [null, null]);
});

test("a refusal names its stage, Core's codes and the steps the binding could not answer", async () => {
  const unresolved: UnresolvedStep[] = [{ nodeDefinitionId: "web.output.dom-click", differingPaths: ["target.handle"], reason: "no recorded resolution" }];
  const refused = await rebuildSubflowCandidate(context, { briefId: "brief-1", script: "same", submitStep: 109, recordedSubflow: { revision: 10, digest: "s10" }, recordedWhole: null, binding: refusing, unresolved: () => unresolved });
  assert.deepEqual([refused.candidate, refused.refusal?.stage, refused.refusal?.codes, refused.refusal?.unresolved], [null, "subflow", ["web.handle.unknown"], unresolved]);
  const joins = await rebuildSubflowCandidate(context, { briefId: "brief-1", script: "joins", submitStep: 109, recordedSubflow: { revision: 10, digest: "s10" }, recordedWhole: null, binding: unchanged });
  assert.deepEqual([joins.refusal?.stage, joins.refusal?.codes, joins.subflow.matches], ["assembly", ["project.assembly_refused"], true]);
  await assert.rejects(rebuildSubflowCandidate(context, { briefId: "brief-9", script: "same", submitStep: null, recordedSubflow: null, recordedWhole: null, binding: unchanged }), /no brief brief-9/);
});
