// The gateway payload of a failed text wait carries `textPresence` and
// `visibleNear` (t369, `actions/text-sighting.ts`): copied and bounded, only on
// a result that did not succeed, and nothing at all when the result has none.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationActionResult } from "../../actions/types";
import { webAutomationActionResultPayload } from "../gateway-mapping";

function waited(extra: Partial<WebAutomationActionResult> = {}): WebAutomationActionResult {
  return {
    commandId: "command.wait",
    actionType: "web.dom.wait_for_text",
    status: "timed_out",
    validation: { status: "failed", expected: "page text containing Cart (3)", actual: "the text did not appear before the timeout" },
    startedAt: 10,
    finishedAt: 5_010,
    ...extra
  };
}

test("a failed text wait's sighting rides the payload as the client sent it", () => {
  const payload = webAutomationActionResultPayload(waited({ textPresence: "hidden", visibleNear: ["Cart", "View cart"] }));
  assert.equal(payload.textPresence, "hidden");
  assert.deepEqual(payload.visibleNear, ["Cart", "View cart"]);
});

test("an absent text with nothing shown near it still says absent", () => {
  const payload = webAutomationActionResultPayload(waited({ textPresence: "absent", visibleNear: [] }));
  assert.equal(payload.textPresence, "absent");
  assert.deepEqual(payload.visibleNear, []);
});

test("a result with no sighting, and a success, carry neither key", () => {
  for (const result of [waited(), waited({ status: "succeeded", validation: { status: "passed", expected: "x", actual: "x" }, textPresence: "hidden", visibleNear: ["Cart"] })]) {
    const payload = webAutomationActionResultPayload(result);
    assert.equal("textPresence" in payload, false);
    assert.equal("visibleNear" in payload, false);
  }
});

test("only a known presence and at most three bounded string snippets travel", () => {
  const malformed = { textPresence: "maybe", visibleNear: ["Cart"] } as unknown as Partial<WebAutomationActionResult>;
  assert.equal("textPresence" in webAutomationActionResultPayload(waited(malformed)), false);
  const crowded = { textPresence: "hidden", visibleNear: ["a", 7, "", "x".repeat(81), "b", "c", "d"] } as unknown as Partial<WebAutomationActionResult>;
  assert.deepEqual(webAutomationActionResultPayload(waited(crowded)).visibleNear, ["a", "b", "c"]);
});
