// The gateway payload of an action result carries `checkWait` -- a robot check
// that cleared by itself, untouched -- copied and bounded, and nothing at all
// when the result has none.

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
    finishedAt: 8_500,
    ...extra
  };
}

test("a result whose check cleared by itself carries checkWait on the payload", () => {
  assert.deepEqual(webAutomationActionResultPayload(clicked({ checkWait: { waitedMs: 8_412 } })).checkWait, { waitedMs: 8_412 });
});

test("a result with no check wait carries no checkWait key", () => {
  assert.equal("checkWait" in webAutomationActionResultPayload(clicked()), false);
});

test("the payload copies waitedMs alone, and drops a wait outside the bound", () => {
  const extra = { waitedMs: 8_000, note: "page text" } as unknown as WebAutomationActionResult["checkWait"];
  assert.deepEqual(webAutomationActionResultPayload(clicked({ checkWait: extra })).checkWait, { waitedMs: 8_000 });
  assert.equal("checkWait" in webAutomationActionResultPayload(clicked({ checkWait: { waitedMs: -5 } })), false);
  assert.equal("checkWait" in webAutomationActionResultPayload(clicked({ checkWait: { waitedMs: 600_001 } })), false);
});
