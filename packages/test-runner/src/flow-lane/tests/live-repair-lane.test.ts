import assert from "node:assert/strict";
import test from "node:test";
import { runFlowLane, type FlowLaneInput } from "../run-flow-lane.js";

test("live repair authorization cannot reactivate the retired recording-only conversion", async () => {
  let authorized = 0;
  const input: FlowLaneInput = new Proxy(Object.create(null), { get(_target, key) {
    if (key === "authorizeLiveLlm") return async () => { authorized++;
  return { intent: "explore_and_adapt", permittedConsequences: [] }; };
    throw new Error("Retired lane inspected execution input");
  } });
  await assert.rejects(() => runFlowLane(input), /Recording-only Flow creation is retired/);
  assert.equal(authorized, 0);
});
