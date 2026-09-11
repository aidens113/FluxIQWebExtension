import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_ACTION_SAFETY } from "../actions/safety";
import { WEB_AUTOMATION_ACTION_TYPES, type WebAutomationActionType } from "../actions/types";
import { webAutomationManifestOutputs } from "../io/manifest-definitions";
import { webAutomationOutputNodeDefinitions } from "../output-nodes";

// Written out rather than read from the registry, so reclassifying an output
// has to change this table as well as the registry.
const SAFE_OUTPUTS: readonly WebAutomationActionType[] = [
  "web.dom.wait_for_selector",
  "web.dom.wait_for_text",
  "web.dom.extract",
  "web.dom.capture_snapshot"
];

test("the safety registry classifies every output exactly once, and only the observe and wait outputs as safe", () => {
  assert.deepEqual(Object.keys(WEB_AUTOMATION_ACTION_SAFETY).sort(), [...WEB_AUTOMATION_ACTION_TYPES].sort());
  for (const outputId of WEB_AUTOMATION_ACTION_TYPES) {
    assert.equal(WEB_AUTOMATION_ACTION_SAFETY[outputId], SAFE_OUTPUTS.includes(outputId) ? "safe" : "review", outputId);
  }
});

test("the domain manifest and the output-node definitions give each output one consistent classification", () => {
  for (const outputId of WEB_AUTOMATION_ACTION_TYPES) {
    const manifestOutputs = webAutomationManifestOutputs.filter((output) => output.id === outputId);
    const nodes = webAutomationOutputNodeDefinitions.filter((definition) => definition.outputAction?.fixedOutputId === outputId);
    assert.equal(manifestOutputs.length, 1, `${outputId} has one manifest output`);
    assert.equal(nodes.length, 1, `${outputId} has one output node`);
    const safe = SAFE_OUTPUTS.includes(outputId);
    assert.deepEqual({
      level: manifestOutputs[0]!.safety.level,
      requiresApproval: manifestOutputs[0]!.safety.requiresApproval,
      privileged: nodes[0]!.safety?.privileged,
      requiresOperatorApproval: nodes[0]!.safety?.requiresOperatorApproval
    }, {
      level: safe ? "safe" : "review",
      requiresApproval: !safe,
      privileged: !safe,
      requiresOperatorApproval: !safe
    }, outputId);
  }
});
