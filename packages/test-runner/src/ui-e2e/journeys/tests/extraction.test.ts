// The shape a recording-generated extraction Subflow must have.

import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { assertExtractionRecordingDerivedFlow } from "../extraction.js";

const extract = (recordingId = "recording.one", outputId = "web.dom.extract_list") => ({ definitionId: "builtin.policy.action", parameterValues: { outputId }, metadata: { evidence: [{ artifactId: recordingId }] } });
const rejected = (error: unknown) => error instanceof RunnerFailure && error.details?.reasonCode === "extraction.generated_flow_shape";

test("one recorded extract_list policy action is the generated Subflow", () => {
  assert.doesNotThrow(() => assertExtractionRecordingDerivedFlow({ nodes: [extract()], edges: [] }, "recording.one"));
  assert.doesNotThrow(() => assertExtractionRecordingDerivedFlow({ nodes: [extract()], edges: [] }));
});

test("a second node, another action, or another recording's provenance is refused", () => {
  assert.throws(() => assertExtractionRecordingDerivedFlow({ nodes: [extract(), extract()], edges: [] }, "recording.one"), rejected);
  assert.throws(() => assertExtractionRecordingDerivedFlow({ nodes: [extract("recording.one", "web.dom.click")], edges: [] }, "recording.one"), rejected);
  assert.throws(() => assertExtractionRecordingDerivedFlow({ nodes: [extract("recording.other")], edges: [] }, "recording.one"), rejected);
});
