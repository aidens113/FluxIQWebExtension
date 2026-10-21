import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_ARRIVAL_STEP_KEY, automationStudioCandidateFingerprint } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { harvestRecordedResolutions } from "../recorded-resolutions.js";
import { fakeAuthoring, fakeContext, type FakeQuestion } from "./authoring-fakes.js";

const canonical = (value: unknown): string => JSON.stringify(automationStudioCandidateFingerprint.snapshot(value));
const CLICK = "web.output.dom-click";
const MERGE = "builtin.control.merge";
const NAVIGATE = "web.output.browser-navigate";
const FACT = "fluxiq.fact.target";

const plan: JsonObject = {
  subflows: [{
    key: "collect",
    metadata: { "fluxiq.successCheck": [{ fact: "exists", op: "exists", target: { selector: "h2", element: { tag: "h2" } } }] },
    nodes: [
      { key: AUTOMATION_STUDIO_ARRIVAL_STEP_KEY, definitionId: NAVIGATE, parameters: { url: "http://example.test/" } },
      { key: "s1", definitionId: CLICK, parameters: { selector: "#a", element: { tag: "div" }, timeoutMs: 10 } },
      { key: "s2", definitionId: MERGE, parameters: { mergeMode: "first" } },
      { key: "s3", definitionId: CLICK, parameters: { selector: "#b", element: { tag: "div" }, timeoutMs: 10 } },
      { key: "s4", definitionId: MERGE, parameters: { mergeMode: "first" } },
    ],
  }],
};
const questions: FakeQuestion[] = [
  { nodeDefinitionId: FACT, parameters: { target: { handle: "t9" } } },
  { nodeDefinitionId: CLICK, parameters: { target: { handle: "t1" }, timeoutMs: 10 } },
  { nodeDefinitionId: MERGE, parameters: { mergeMode: "first" } },
  { nodeDefinitionId: CLICK, parameters: { target: { handle: "t2" }, timeoutMs: 10 } },
  { nodeDefinitionId: MERGE, parameters: { mergeMode: "first" } },
];

test("pairs each question Core asks with the persisted plan's step at the same place, and proves itself by the digests", async () => {
  const authoring = fakeAuthoring({ script: { questions, subflowDigest: "s16", wholeDigest: "w8" } });
  const harvest = await harvestRecordedResolutions(fakeContext(authoring, plan, "w8"), { briefId: "brief-1", script: "script", submitStep: 141, recordedSubflow: { revision: 16, digest: "s16" }, canonical });
  assert.equal(harvest.verified, true);
  assert.equal(harvest.pairingFailure, null);
  // The two merges, written alike, are one resolution; the arrival step is never asked about.
  assert.deepEqual(harvest.resolutions.map((entry) => entry.nodeDefinitionId), [FACT, CLICK, MERGE, CLICK]);
  assert.deepEqual(harvest.resolutions[0]!.resolved, { selector: "h2", element: { tag: "h2" } });
  assert.deepEqual(harvest.resolutions[3]!.resolved, { selector: "#b", element: { tag: "div" }, timeoutMs: 10 });
});

test("a rebuild whose digests differ is not verified, and a broken pairing is named", async () => {
  const drifted = await harvestRecordedResolutions(fakeContext(fakeAuthoring({ script: { questions, subflowDigest: "s16", wholeDigest: "w-other" } }), plan, "w8"), { briefId: "brief-1", script: "script", submitStep: 141, recordedSubflow: { revision: 16, digest: "s16" }, canonical });
  assert.equal(drifted.verified, false);
  assert.equal(drifted.rebuild.whole.matches, false);
  const misordered = [questions[0]!, questions[2]!, questions[1]!];
  const broken = await harvestRecordedResolutions(fakeContext(fakeAuthoring({ script: { questions: misordered, subflowDigest: "s16", wholeDigest: "w8" } }), plan, "w8"), { briefId: "brief-1", script: "script", submitStep: 141, recordedSubflow: { revision: 16, digest: "s16" }, canonical });
  assert.equal(broken.verified, false);
  assert.match(broken.pairingFailure ?? "", /Pairing broke: Core asked about builtin\.control\.merge where the persisted plan holds web\.output\.dom-click/);
});

test("only a one-subflow persisted plan is paired", async () => {
  const two = { subflows: [...(plan.subflows as JsonObject[]), { key: "other", nodes: [] }] };
  await assert.rejects(harvestRecordedResolutions(fakeContext(fakeAuthoring({}), two, "w8"), { briefId: "brief-1", script: "script", submitStep: null, recordedSubflow: { revision: 1, digest: "s" }, canonical }), /one-subflow plan/);
});
