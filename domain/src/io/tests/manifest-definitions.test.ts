// The domain manifest is the registration Core reads at runtime, and element
// targeting is declared in two places that must never disagree.
//
// `runtime/io-policy.ts` `prepareElementTargetAction` resolves a recorded
// fingerprint against the runtime candidates, and applies
// `elementTargetMinimumConfidence`, only for an output whose
// `DomainOutputDefinition` declares `metadata.elementTarget`. That definition is
// the one registered here through `defineOutput` (`io/web-automation-io.ts`,
// `web-panel-host.ts`). The `AutomationStudioNodeDefinition` in
// `output-nodes/definitions.ts` declares the same thing for the authoring
// surface, and Core does not read it for this. Both are derived from the
// action's own schema row, and these tests hold them together.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_ACTION_TYPES, type WebAutomationActionType } from "../../actions/types";
import { webAutomationActionDefinitions } from "../../actions/schemas";
import { webAutomationOutputNodeDefinitions } from "../../output-nodes";
import { webAutomationManifestOutputs } from "../manifest-definitions";

// Restated by hand rather than derived, so an unintended change to the rule on
// either side fails here instead of silently changing what Core resolves. These
// are the actions that cannot run without an element: Core fails an action
// outright with `element_target.missing_fingerprint` when the flag is set and
// no fingerprint is supplied, so a delta scroll, a key press to the focused
// element, a URL assertion or a tab operation must never appear in this list.
const ELEMENT_TARGETED_OUTPUTS: readonly WebAutomationActionType[] = [
  "web.dom.check",
  "web.dom.clear",
  "web.dom.click",
  "web.dom.extract",
  "web.dom.select",
  "web.dom.type",
  "web.dom.upload",
  "web.dom.wait_for_selector"
];

function manifestOutput(outputId: WebAutomationActionType) {
  const output = webAutomationManifestOutputs.find((candidate) => candidate.id === outputId);
  assert.ok(output, `${outputId} has a manifest output`);
  return output;
}

function nodeDefinition(outputId: WebAutomationActionType) {
  const node = webAutomationOutputNodeDefinitions.find((candidate) => candidate.outputAction?.fixedOutputId === outputId);
  assert.ok(node, `${outputId} has an output node`);
  return node;
}

test("the manifest declares element targeting for exactly the outputs that cannot run without an element", () => {
  const declared = WEB_AUTOMATION_ACTION_TYPES
    .filter((outputId) => manifestOutput(outputId).metadata?.elementTarget === true)
    .sort();
  assert.deepEqual(declared, [...ELEMENT_TARGETED_OUTPUTS].sort());
});

test("the manifest and the output nodes declare element targeting for the same outputs", () => {
  // Two registries, one rule. The node definition is inert for this purpose —
  // Core reads the manifest — but a disagreement between them means one of the
  // two derivations has drifted from the action schema, which is the defect
  // this test exists to catch.
  for (const outputId of WEB_AUTOMATION_ACTION_TYPES) {
    assert.equal(
      manifestOutput(outputId).metadata?.elementTarget === true,
      nodeDefinition(outputId).metadata?.elementTarget === true,
      `${outputId}: the manifest output and the output node must agree on element targeting`
    );
  }
});

test("element targeting follows the action's own schema row on both sides", () => {
  for (const outputId of WEB_AUTOMATION_ACTION_TYPES) {
    const schema = webAutomationActionDefinitions.find((candidate) => candidate.actionType === outputId)?.parameterSchema;
    const requiresSelector = Array.isArray(schema?.required) && schema.required.includes("selector");
    assert.equal(manifestOutput(outputId).metadata?.elementTarget === true, requiresSelector, `${outputId}: the manifest follows its schema`);
  }
});

test("an output that is not element targeted declares no element-target metadata at all", () => {
  // Absent, not `false`. Core tests `=== true`, so `false` would behave the
  // same, but a declared `false` reads as a decision that was made about an
  // action that never had a target to resolve.
  for (const outputId of WEB_AUTOMATION_ACTION_TYPES) {
    if (ELEMENT_TARGETED_OUTPUTS.includes(outputId)) continue;
    assert.equal(manifestOutput(outputId).metadata, undefined, `${outputId} carries no element-target metadata`);
  }
});

test("every element-targeted output carries the safety level Core turns into a confidence floor", () => {
  // `elementTargetMinimumConfidence` reads `safety.level` off this same
  // definition and falls back to 0.5 for anything it does not recognize. Every
  // Week 1 element-targeted action is `review` (0.68) or `safe` (0.45), so the
  // fallback must never be what applies.
  for (const outputId of ELEMENT_TARGETED_OUTPUTS) {
    const level = manifestOutput(outputId).safety.level;
    assert.ok(
      ["safe", "review", "privileged", "destructive"].includes(level),
      `${outputId}: safety.level ${level} is not one Core's confidence ladder recognizes`
    );
  }
});
