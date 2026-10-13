import assert from "node:assert/strict";
import test from "node:test";
import { runFlowLane, type FlowLaneInput } from "../run-flow-lane.js";
import { RunnerFailure } from "../../failure.js";

test("the retired recording lane refuses before reading controls, resetting or dispatching", async () => {
  let touched = 0;
  const control: FlowLaneInput["control"] = new Proxy(Object.create(null), { get() { touched++;
  throw new Error("Retired lane reached a control"); } });
  const input: FlowLaneInput = {
    control, projectId: "project.test", recordingId: "recording.test", authorizationPin: "unused",
    scenario: { schemaVersion: "0.1", id: "everything-store", title: "Fixture", tags: [], seed: 1, startPath: "/", capabilities: [], networkPolicy: "loopback-only", recordingScript: [], expected: {} },
    workflow: { workflowId: undefined, variant: undefined, recordingScript: [], expected: {} },
    recordingEvents: [], facilityRunId: "run-test", scenarioOrigin: "http://127.0.0.1:1", runToken: "unused", secrets: [],
    prepareFlowPage: async () => { touched++; }, recordEvidence: async () => { touched++; },
    checkFinalState: async () => { touched++;
  return true; }, flowDispatchStarting: () => { touched++; }
  };
  await assert.rejects(() => runFlowLane(input), (error: unknown) => error instanceof RunnerFailure && error.details?.code === "automation.instruction_led_authoring_required" && error.message.includes("--llm-task create-flow"));
  assert.equal(touched, 0);
});
