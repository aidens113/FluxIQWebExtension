// The output dispatcher's reading of an interrupted or never-received command's
// result (plan B3, Core C8).

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationInterruptedDispatchReading } from "..";

test("the dispatcher restates Core's not_seen result for a press as a failure that did nothing", () => {
  const reading = webAutomationInterruptedDispatchReading("web.dom.click", {}, { status: "not_seen" });
  assert.equal(reading?.status, "failed");
  assert.equal(reading?.failure.effect, "unacted");
  assert.equal(webAutomationInterruptedDispatchReading("web.dom.click", {}, { status: "succeeded" }), undefined);
});
