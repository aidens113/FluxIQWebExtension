import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { assertFlowLaneBuiltFlow } from "../built-flow.js";

const builtNoFlow = (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /built no Flow/u.test(error.message);

test("a Flow-lane run on an evaluated target fails unless the lane published a Flow it created", () => {
  // The six week1 false passes: no Core identity, so the lane never ran and published nothing.
  assert.throws(() => assertFlowLaneBuiltFlow({ flowLane: true, evaluated: true, published: undefined }), builtNoFlow);
  assert.throws(() => assertFlowLaneBuiltFlow({ flowLane: true, evaluated: true, published: { flowCreated: false } }), builtNoFlow);
  assert.doesNotThrow(() => assertFlowLaneBuiltFlow({ flowLane: true, evaluated: true, published: { flowCreated: true } }));
});

test("the recording lane, and the existing and clone targets, are not judged on a Flow of their own", () => {
  assert.doesNotThrow(() => assertFlowLaneBuiltFlow({ flowLane: false, evaluated: true, published: undefined }), "the recording lane builds no Flow");
  assert.doesNotThrow(() => assertFlowLaneBuiltFlow({ flowLane: true, evaluated: false, published: undefined }), "existing and clone run a pre-existing Flow");
});
