// What a recording of each failure-journey task must generate.

import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { assertRecordedTaskFlow, RECORDED_TASKS } from "../recorded-task.js";

const node = (outputId: string, recordingId = "recording.one") => ({ definitionId: "builtin.policy.action", parameterValues: { outputId }, metadata: { evidence: [{ artifactId: recordingId }] } });
const rejected = (error: unknown) => error instanceof RunnerFailure && error.details?.reasonCode === "task.generated_flow_shape";

test("the missing-target task is one recorded click, optionally with a navigation or a scroll", () => {
  const task = RECORDED_TASKS["missing-target"];
  assert.equal(task.scenarioId, "llm-target-drift");
  assert.doesNotThrow(() => assertRecordedTaskFlow(task, { nodes: [node("web.dom.click")] }, "recording.one"));
  assert.doesNotThrow(() => assertRecordedTaskFlow(task, { nodes: [node("web.browser.navigate"), node("web.dom.click")] }, "recording.one"));
  assert.throws(() => assertRecordedTaskFlow(task, { nodes: [node("web.dom.type")] }, "recording.one"), rejected);
  assert.throws(() => assertRecordedTaskFlow(task, { nodes: [node("web.dom.click", "recording.other")] }, "recording.one"), rejected);
});

test("the redesigned-field task types, chooses and clicks, and nothing it did not record", () => {
  const task = RECORDED_TASKS["redesigned-field"];
  assert.equal(task.scenarioId, "instruction-only-form");
  const recorded = ["web.dom.type", "web.dom.select", "web.dom.click"].map(output => node(output));
  assert.doesNotThrow(() => assertRecordedTaskFlow(task, { nodes: recorded }, "recording.one"));
  assert.throws(() => assertRecordedTaskFlow(task, { nodes: recorded.slice(0, 2) }, "recording.one"), rejected);
  assert.throws(() => assertRecordedTaskFlow(task, { nodes: [...recorded, node("web.dom.extract_list")] }, "recording.one"), rejected);
});
