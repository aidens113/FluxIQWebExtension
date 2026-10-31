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

test("a press starting in the on state preserves both observed states through the gateway", () => {
  const toggle = { via: "attribute", attribute: "aria-pressed", to: false };
  const toggleBefore = { via: "attribute", attribute: "aria-pressed", to: true };
  const result = { ...clicked(), toggle, toggleBefore } as WebAutomationActionResult;
  const payload = webAutomationActionResultPayload(result);
  assert.deepEqual(payload.toggle, toggle);
  assert.deepEqual(payload.toggleBefore, toggleBefore);
});

test("no toggle travels on a failed or skipped press, nor one the reader does not accept", () => {
  const toggle = { via: "attribute", attribute: "aria-pressed", to: true } as const;
  assert.equal("toggle" in webAutomationActionResultPayload(clicked({ status: "failed", toggle })), false);
  assert.equal("toggle" in webAutomationActionResultPayload(clicked({ skipped: "already_in_state", toggle })), false);
  const stray = { via: "attribute", attribute: "data-state", to: true } as unknown as WebAutomationActionResult["toggle"];
  assert.equal("toggle" in webAutomationActionResultPayload(clicked({ toggle: stray })), false);
  assert.equal("toggle" in webAutomationActionResultPayload(clicked()), false);
  for (const extra of [{ status: "failed" as const }, { skipped: "already_in_state" as const }]) {
    const payload = webAutomationActionResultPayload(clicked({ ...extra, toggle, toggleBefore: toggle }));
    assert.equal("toggleBefore" in payload, false);
  }
  assert.equal("toggleBefore" in webAutomationActionResultPayload(clicked({ toggle, toggleBefore: stray })), false);
});
