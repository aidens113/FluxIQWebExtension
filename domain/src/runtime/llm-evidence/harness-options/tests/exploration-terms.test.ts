import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExplorationRefusalClassifier, webAutomationExplorationScope } from "..";

// Core is handed an opaque string and answers in its own closed vocabulary of
// refusal kinds. No refusal ends an exploration (Core t1057); classifying one
// only says what kind it was. The unclassified rows are the point: an answer
// the model can act on is feedback, not a refusal of what the exploration may do.
test("reads only the scope refusals as Core's refusal kinds", () => {
  // `target_unsafe` is no longer a code this domain can raise: it meant FluxIQ
  // had judged a control too dangerous to press from how it looked, and that
  // judgement is gone. Nothing maps to `destructive_action_refused` any more.
  assert.equal(webAutomationExplorationRefusalClassifier("web.action.rejected.target_unsafe"), undefined);
  assert.equal(webAutomationExplorationRefusalClassifier("web.action.rejected.out_of_scope"), "out_of_scope_refused");
  assert.equal(webAutomationExplorationRefusalClassifier("web.action.rejected.cross_origin"), "out_of_scope_refused");
  for (const code of ["web.action.rejected.invalid_input", "web.action.rejected.no_progress", "web.action.rejected.target_unobserved", "web.action.rejected.sensitive_value", "web.action.rejected.no_repeating_structure", "web.inspect.succeeded", "web.action.succeeded", "web.structure.detected"]) {
    assert.equal(webAutomationExplorationRefusalClassifier(code), undefined, code);
  }
});

test("tells Core where it is in Core's own terms, which are opaque strings", () => {
  assert.equal(webAutomationExplorationScope("https://example.test/a/b?c=d"), "https://example.test");
});
