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

const stoppedForPermission = (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /stopped_for_permission/u.test(error.message) && (error.details as { verdict?: unknown } | undefined)?.verdict === "stopped_for_permission";

test("a build that stopped to ask at its declared permission point is stopped_for_permission, never a pass", () => {
  // Lane D's bigbox pickup-order: 12 such runs were recorded as passes, every one with flowCreated false.
  const stop = { consequence: "move_money", control: "matched" } as const;
  assert.throws(() => assertFlowLaneBuiltFlow({ flowLane: true, evaluated: true, published: undefined, permissionStop: stop }), stoppedForPermission);
  assert.throws(() => assertFlowLaneBuiltFlow({ flowLane: true, evaluated: true, published: { flowCreated: false }, permissionStop: stop }), stoppedForPermission);
  // Even a published Flow does not turn a stop into a pass: the stop means the build never finished the task.
  assert.throws(() => assertFlowLaneBuiltFlow({ flowLane: true, evaluated: true, published: { flowCreated: true }, permissionStop: stop }), stoppedForPermission);
  try { assertFlowLaneBuiltFlow({ flowLane: true, evaluated: true, published: { flowCreated: false }, permissionStop: { consequence: "delete", control: "unnamed" } }); assert.fail("a permission stop passed"); }
  catch (error) { assert.deepEqual((error as RunnerFailure).details, { verdict: "stopped_for_permission", consequence: "delete", control: "unnamed", flowCreated: false }); }
});

test("a build the person granted and that continued passes only if it then created its Flow", () => {
  // The Lab plays the person, grants, and the build continues: no stop is left, so the ordinary rule judges it.
  assert.throws(() => assertFlowLaneBuiltFlow({ flowLane: true, evaluated: true, published: { flowCreated: false } }), builtNoFlow);
  assert.doesNotThrow(() => assertFlowLaneBuiltFlow({ flowLane: true, evaluated: true, published: { flowCreated: true } }));
});
