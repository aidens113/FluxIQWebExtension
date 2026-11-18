import assert from "node:assert/strict";
import test from "node:test";
import { approvedClientModelScript } from "../script.js";

test("the fixture answers only the ordered real access probes and records safe receipts", () => {
  const fixture = approvedClientModelScript();
  const names = ["configured-later", "after-panel-logout", "after-reconnect", "after-core-restart", "approved-without-password"];
  const replies = fixture.script.replies.panel_command!;
  for (const [index, name] of names.entries()) {
    const reply = replies[index]!({ kind: "panel_command", ordinal: index + 1, model: "fixture-model", jsonText: true, message: `Check approved client access: ${name}`, payload: undefined });
    assert.deepEqual(reply, { reply: `Approved client access confirmed: ${name}` });
  }
  assert.deepEqual(fixture.receipts(), names);
  assert.deepEqual(Object.keys(fixture.script.replies), ["panel_command"]);
});

test("unexpected model work cannot receive an apparently successful fixture answer", () => {
  const fixture = approvedClientModelScript();
  assert.throws(() => fixture.script.replies.panel_command![0]!({ kind: "panel_command", ordinal: 1, model: "fixture-model", jsonText: true, message: "unexpected-private-message", payload: undefined }), (error) => {
    assert.doesNotMatch(String(error), /unexpected-private-message/u);
    return /unexpected probe/u.test(String(error));
  });
  assert.deepEqual(fixture.receipts(), []);
});
