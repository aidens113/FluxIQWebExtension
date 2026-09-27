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
  "web.dom.capture_snapshot",
  // An assertion and a list extraction only read the page. The other five
  // outputs added in Week 1 change the page or the browser, so they are review.
  "web.dom.assert",
  "web.dom.extract_list"
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
    // **The three approval flags asserted `!safe`, and that assertion was the
    // bug (t166).** `level` is how sure Core must be of a target match before it
    // acts, and it still varies. The other three are permission, and none of
    // them may be decided by the kind of action: Core drops a tool whose
    // `requiresOperatorApproval` nobody pre-approved, without saying so, and
    // marks any plan containing a `privileged` node high risk so a repair cannot
    // apply itself. Both fired on every click, keypress, navigation and scroll.
    // What an action would cause is declared per action and gated by Core's
    // action permission gate, which is what still stops a delete or a checkout.
    // The manifest no longer has a `requiresApproval` field at all, which is why
    // reading it here is a compile error rather than a comparison: removed, not
    // defaulted.
    assert.deepEqual(Object.keys(manifestOutputs[0]!.safety), ["level"], outputId);
    assert.deepEqual({
      level: manifestOutputs[0]!.safety.level,
      privileged: nodes[0]!.safety?.privileged,
      requiresOperatorApproval: nodes[0]!.safety?.requiresOperatorApproval
    }, {
      level: safe ? "safe" : "review",
      privileged: false,
      requiresOperatorApproval: false
    }, outputId);
  }
});
