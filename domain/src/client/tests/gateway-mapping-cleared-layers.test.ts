// The gateway payload of an action result carries `clearedLayers` -- what the
// extension's interference clearing pressed -- copied through its closed sets,
// and nothing at all when the result has none (t401).

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationActionResult } from "../../actions/types";
import { webAutomationActionResultPayload } from "../gateway-mapping";

function clicked(extra: Partial<WebAutomationActionResult> = {}): WebAutomationActionResult {
  return {
    commandId: "command.click",
    actionType: "web.dom.click",
    status: "succeeded",
    validation: { status: "passed", expected: "the click to be made", actual: "the click was made" },
    startedAt: 10,
    finishedAt: 900,
    ...extra
  };
}

test("a result whose execution closed a layer carries clearedLayers on the payload", () => {
  assert.deepEqual(webAutomationActionResultPayload(clicked({ clearedLayers: [{ kind: "rate_limit", control: "OK" }] })).clearedLayers, [{ kind: "rate_limit", control: "OK" }]);
});

test("a result that closed nothing carries no clearedLayers key", () => {
  assert.equal("clearedLayers" in webAutomationActionResultPayload(clicked()), false);
  assert.equal("clearedLayers" in webAutomationActionResultPayload(clicked({ clearedLayers: [] })), false);
});

test("the payload copies the two closed words alone", () => {
  const extra = [{ kind: "dialog", control: "No thanks", label: "No thanks, I would rather pay full price" }] as unknown as WebAutomationActionResult["clearedLayers"];
  assert.deepEqual(webAutomationActionResultPayload(clicked({ clearedLayers: extra })).clearedLayers, [{ kind: "dialog", control: "No thanks" }]);
});
