// What a judge needs to find the page a run started and ended on (t1036 Lab run `run-mwvsbihx-e60f9f0f`): Core reads
// those views by the domain's declared view keys, so the keyed page view the page channel delivers must stay one of
// them. When it left them, Core found no page to show the judge beside its yes.
import assert from "node:assert/strict";
import test from "node:test";
import { createWebAutomationLlmEvidenceRuntime } from "../../tools";

test("the page the page channel delivers is also a declared view, so Core finds the page a run started and ended on", () => {
  const runtime = createWebAutomationLlmEvidenceRuntime({ eligibleSessionIds: () => ["session"], executeAction: async () => { throw new Error("this unit binding must not dispatch"); } });
  const member = runtime.pageChannel?.member;
  assert.equal(member, "pageView");
  assert.equal(runtime.observedStateKeys.includes(member!), true);
});
