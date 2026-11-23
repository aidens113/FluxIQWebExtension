import assert from "node:assert/strict";
import test from "node:test";
import { scriptedModelScriptFor } from "../index.js";

test("social permission probe retains the typed instruction, declares deletion and offers no executable decision", () => {
  const task = "social-network-feed-delete-stranger-requests";
  assert.throws(() => scriptedModelScriptFor(task), /not a full task script/u);
  const script = scriptedModelScriptFor(task, "preflight-permission");
  const message = "An unchanged fixture task instruction";
  assert.deepEqual(script.replies.panel_command![0]!({ kind: "panel_command", ordinal: 1, model: "claude-haiku-5-5", jsonText: false, message, payload: undefined }), { do: "flow.createHere", with: { instruction: message }, acts: ["delete"], process: null });
  assert.deepEqual(Object.keys(script.replies), ["panel_command"]);
});
