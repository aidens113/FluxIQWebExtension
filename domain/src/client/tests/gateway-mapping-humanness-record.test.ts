// The gateway payload of an action result carries the `humanness` record a
// click, type or scroll run above level 0 made (its level, whether the press
// was aimed, and a misclick's point), copied field by field; a result at level
// 0 carries no such key.

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

test("the record is copied with its level, aim and misclick point", () => {
  assert.deepEqual(webAutomationActionResultPayload(clicked({ humanness: { level: 80, aimed: true, misclick: { x: 3, y: 4 } } })).humanness, { level: 80, aimed: true, misclick: { x: 3, y: 4 } });
  assert.deepEqual(webAutomationActionResultPayload(clicked({ humanness: { level: 40, aimed: false } })).humanness, { level: 40, aimed: false });
});

test("only the named fields are copied", () => {
  const copied = webAutomationActionResultPayload(clicked({ humanness: { level: 80, aimed: true, stray: "x", misclick: { x: 1, y: 2, z: 3 } } })).humanness;
  assert.deepEqual(copied, { level: 80, aimed: true, misclick: { x: 1, y: 2 } });
});

test("a result with no record, or an unreadable one, carries no humanness key", () => {
  assert.equal("humanness" in webAutomationActionResultPayload(clicked()), false);
  assert.equal("humanness" in webAutomationActionResultPayload(clicked({ humanness: { level: "high", aimed: true } })), false);
  assert.equal("humanness" in webAutomationActionResultPayload(clicked({ humanness: undefined })), false);
});
