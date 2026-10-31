import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_ACTION_TYPES } from "../../../actions/types";
import { webAutomationResolvedActionEffect } from "../../../actions/action-effect";
import { webAutomationActionCommits, webAutomationInterruptedDispatchReading } from "..";

test("every interruption uses the trusted parameter-aware effect floor", () => {
  for (const action of WEB_AUTOMATION_ACTION_TYPES) {
    for (const parameters of [undefined, {}, { submit: true }, { submit: false }, { submit: "true" }, { submit: { binding: "state", fallback: false } }, { newTab: false }, { newTab: true }, { newTab: { $state: { path: "tab", fallback: false } } }]) {
      const commits = webAutomationResolvedActionEffect(action, parameters)?.effectClass === "commit";
      assert.equal(webAutomationActionCommits(action, parameters), commits, action);
      const reading = webAutomationInterruptedDispatchReading(action, parameters, { status: "interrupted", effect: "unknown" });
      assert.equal(reading?.failure.effect, commits ? "ambiguous" : "unacted", action);
    }
  }
});

test("downloads, tabs and Next retain uncertainty without requiring new consequence declarations", () => {
  for (const action of ["web.browser.download", "web.browser.tab", "web.dom.next_page"]) {
    assert.equal(webAutomationActionCommits(action, {}), true, action);
  }
  assert.equal(webAutomationActionCommits("unknown", {}), false);
  assert.equal(webAutomationActionCommits("web.dom.type", {}), false);
  assert.equal(webAutomationActionCommits("web.dom.type", { submit: false }), false);
  assert.equal(webAutomationActionCommits("web.dom.type", { submit: true }), true);
});
