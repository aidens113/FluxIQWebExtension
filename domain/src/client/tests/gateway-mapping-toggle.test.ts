// The gateway payload of a click result carries `toggle` -- what a press made
// in place changed about its own control (t787) -- read through the
// signature's own reader, and only on a press that was made and succeeded.

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
    finishedAt: 20,
    ...extra
  };
}

test("a press that flipped its control carries its signature on the payload", () => {
  assert.deepEqual(webAutomationActionResultPayload(clicked({ toggle: { via: "class", gains: ["on"], loses: [] } })).toggle, { via: "class", gains: ["on"], loses: [] });
});

test("no toggle travels on a failed or skipped press, nor one the reader does not accept", () => {
  const toggle = { via: "attribute", attribute: "aria-pressed", to: true } as const;
  assert.equal("toggle" in webAutomationActionResultPayload(clicked({ status: "failed", toggle })), false);
  assert.equal("toggle" in webAutomationActionResultPayload(clicked({ skipped: "already_in_state", toggle })), false);
  const stray = { via: "attribute", attribute: "data-state", to: true } as unknown as WebAutomationActionResult["toggle"];
  assert.equal("toggle" in webAutomationActionResultPayload(clicked({ toggle: stray })), false);
  assert.equal("toggle" in webAutomationActionResultPayload(clicked()), false);
});
