// The gateway payload of an action result carries `actedAt` -- when the page
// was first acted on, by the client's clock -- so a step's decision-to-press
// ends at the press itself (task speed S10); a read carries none.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationActionResult } from "../../actions/types";
import { webAutomationActionResultPayload } from "../gateway-mapping";

function clicked(extra: Record<string, unknown> = {}): WebAutomationActionResult {
  return {
    commandId: "command.click",
    actionType: "web.dom.click",
    status: "succeeded",
    validation: { status: "passed", expected: "the click to be made", actual: "the click was made" },
    startedAt: 10,
    finishedAt: 500,
    ...extra
  } as WebAutomationActionResult;
}

test("a result that acted carries its moment beside its start and end", () => {
  assert.equal(webAutomationActionResultPayload(clicked({ actedAt: 42 })).actedAt, 42);
});

test("a result that acted on nothing, or names no number, carries no actedAt key", () => {
  assert.equal("actedAt" in webAutomationActionResultPayload(clicked()), false);
  assert.equal("actedAt" in webAutomationActionResultPayload(clicked({ actedAt: "soon" })), false);
});
