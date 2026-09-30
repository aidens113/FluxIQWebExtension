import assert from "node:assert/strict";
import test from "node:test";
import { keepsRunState } from "../keeps-run-state.js";

test("a run keeps its work directory only when the environment says exactly 1", () => {
  assert.equal(keepsRunState({ FLUXIQ_LAB_KEEP_RUN_STATE: "1" }), true);
});

/** Keeping Core's workspace is the debugging exception, so every other value deletes it as before. */
test("unset, empty, or any other value deletes the work directory", () => {
  assert.equal(keepsRunState({}), false);
  assert.equal(keepsRunState({ FLUXIQ_LAB_KEEP_RUN_STATE: "" }), false);
  assert.equal(keepsRunState({ FLUXIQ_LAB_KEEP_RUN_STATE: "true" }), false);
  assert.equal(keepsRunState({ FLUXIQ_LAB_KEEP_RUN_STATE: "0" }), false);
});
