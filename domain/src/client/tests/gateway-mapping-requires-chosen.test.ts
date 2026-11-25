// A saved act's `requiresChosen` reaches the page as the command's own field
// (t1030), read through its reader, and a list sent in a shape the reader
// refuses refuses the whole command: an act that dropped its check would press
// on with whatever option the page arrived with, which is the defect it closes.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationActionFromGatewayCommand } from "../gateway-mapping";

const REQUIRED = [{ at: { selector: "#branch-collection", element: { tagName: "button", text: "Collection" } }, words: "Collection" }];

const command = (requiresChosen: unknown, actionType = "web.dom.click") => {
  const parameters: JsonObject = { selector: "#add" };
  if (requiresChosen !== undefined) parameters.requiresChosen = requiresChosen as JsonValue;
  return webAutomationActionFromGatewayCommand({ commandId: "command.add", actionType, target: { selector: "#add" }, parameters });
};

test("a readable list rides on the command, each option where it is found again and its words", () => {
  const read = command(REQUIRED);
  assert.equal("status" in read, false, JSON.stringify(read));
  assert.deepEqual((read as { requiresChosen?: unknown }).requiresChosen, [{ at: { selector: "#branch-collection", element: { tagName: "button", text: "Collection" } }, words: "Collection" }]);
  // On a typing or a key press too, which can do a lasting act as a press can.
  assert.equal("requiresChosen" in command(REQUIRED, "web.dom.keypress"), true);
});

test("a list the reader refuses refuses the command, on an act that does not require the field", () => {
  for (const bad of [[], [{ words: "Collection" }], [{ at: { selector: "" }, words: "Collection" }], [{ at: { selector: "#x" }, words: "" }], [{ ...REQUIRED[0], extra: true }], "Collection", Array.from({ length: 17 }, () => REQUIRED[0])]) {
    const read = command(bad);
    assert.equal((read as { status?: string }).status, "rejected", JSON.stringify(bad));
    assert.equal((read as { failure?: { code?: string } }).failure?.code, "web.action.invalid_parameter", JSON.stringify(bad));
  }
});

test("a command that sends none carries none", () => {
  assert.equal("requiresChosen" in command(undefined), false);
});
