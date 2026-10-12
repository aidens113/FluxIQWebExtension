// The commit rule the extension asks before every command is the one a Flow
// step's permission gate uses (`webPlanStepMustDeclare`). It is restated as
// plain values for the browser bundle, so this holds the two to the same
// answer for every action type, with and without a submitting type.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_ACTION_TYPES } from "../../../actions/types";
import { webAutomationOutputNodeId } from "../../../output-nodes";
import { webPlanStepMustDeclare } from "../../../runtime/llm-evidence/plan-resolution";
import { webAutomationActionCommits } from "..";

test("every action type commits exactly when a Flow step running it must declare its consequences", () => {
  const variants: (JsonObject | undefined)[] = [undefined, {}, { submit: true }, { submit: false }, { submit: "true" }];
  for (const actionType of WEB_AUTOMATION_ACTION_TYPES) {
    for (const parameters of variants) {
      assert.equal(
        webAutomationActionCommits(actionType, parameters),
        webPlanStepMustDeclare(webAutomationOutputNodeId(actionType), parameters),
        `${actionType} ${JSON.stringify(parameters)}`
      );
    }
  }
});

test("a press, a key press, a dialog answer and a submitting type commit; plain typing and reads do not", () => {
  assert.equal(webAutomationActionCommits("web.dom.click", undefined), true);
  assert.equal(webAutomationActionCommits("web.dom.keypress", {}), true);
  assert.equal(webAutomationActionCommits("web.dom.dialog", {}), true);
  assert.equal(webAutomationActionCommits("web.dom.type", { submit: true }), true);
  assert.equal(webAutomationActionCommits("web.dom.type", {}), false);
  assert.equal(webAutomationActionCommits("web.dom.extract", {}), false);
  assert.equal(webAutomationActionCommits("web.browser.navigate", {}), false);
});
