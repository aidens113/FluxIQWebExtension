// T1 coverage of the selection policy that sits on top of Core's element
// matcher (Phase 1.3 step 3, Level 2).
//
// Only the policy is covered here: which recorded signals are handed to Core,
// the floor, the margin, and that the confidence reported is Core's own number
// rather than one invented downstream. The scoring itself is Core's and is
// covered by Core's own tests -- a second copy of those assertions here would be
// the second scorer this module exists to avoid.
//
// The import that makes this file run is itself part of what is proven. The
// extension's test runner leaves `fluxiq/*` external, so Node resolves
// `fluxiq/automation-studio/fingerprinting` through the package's `exports` map
// at run time. Before Wave 3 that subpath did not exist and this file could not
// have been loaded; the top-level `fluxiq/automation-studio` barrel it would
// have had to use reaches `node:crypto` and `node:perf_hooks`, which is exactly
// why a content script could not use the matcher at all.
//
// `score.ts` never touches the DOM, so the candidates below carry a stand-in
// element: the module uses it only to hand back the winner, by identity.

import assert from "node:assert/strict";
import test from "node:test";
import type { TargetCandidate } from "../candidates";
import { TARGET_SCORE_FLOOR, TARGET_SCORE_MARGIN, scoreTargetCandidates } from "../score";

/** A candidate whose element is a marker: `score.ts` compares it, never reads it. */
function candidate(candidateId: string, fingerprint: Omit<TargetCandidate["fingerprint"], "candidateId">): TargetCandidate {
  return { element: { candidateId } as unknown as Element, fingerprint: { candidateId, ...fingerprint } };
}

function elementId(element: Element): string {
  return (element as unknown as { candidateId: string }).candidateId;
}

/** The two Continue buttons of the ambiguous-targets fixture, as the resolver describes them. */
const CONTINUE_PRIMARY = candidate("choice-primary", {
  tagName: "button", role: "button", testId: "choice-primary",
  selector: '[data-testid="choice-primary"]', visibleText: "Continue", accessibleName: "Continue",
  isVisibleOnViewport: true
});
const CONTINUE_SECONDARY = candidate("choice-secondary", {
  tagName: "button", role: "button", testId: "choice-secondary",
  selector: '[data-testid="choice-secondary"]', visibleText: "Continue", accessibleName: "Continue",
  isVisibleOnViewport: true
});

test("the recorded control wins its tie, and the confidence is Core's measurement of it", () => {
  const selection = scoreTargetCandidates({
    tagName: "button", implicitRole: "button", testId: "choice-secondary",
    selector: '[data-testid="choice-secondary"]', visibleText: "Continue", accessibleName: "Continue"
  }, [CONTINUE_PRIMARY, CONTINUE_SECONDARY]);

  assert.equal(selection.outcome, "resolved");
  if (selection.outcome !== "resolved") return;
  assert.equal(elementId(selection.chosen.element), "choice-secondary");
  assert.equal(selection.chosen.score.candidateId, "choice-secondary");
  // Every compared signal agreed, so Core scores the twin that carries the
  // recorded test id at the top of its scale and the other well below it.
  assert.equal(selection.chosen.score.normalizedScore, 1);
  assert.ok(selection.chosen.score.confidence > 0.9, `confidence was ${selection.chosen.score.confidence}`);
  assert.ok(selection.runnerUp, "the runner-up is reported so a Flow can see how close the call was");
  assert.ok(
    selection.chosen.score.normalizedScore - (selection.runnerUp?.score.normalizedScore ?? 0) >= TARGET_SCORE_MARGIN,
    "the winner cleared the margin"
  );
  // The confidence is not a constant: it is the number Core computed for this
  // candidate, and it moves with the candidate.
  assert.notEqual(selection.chosen.score.confidence, selection.ranked[1]?.score.confidence);
});

test("identical twins stay a tie rather than becoming a choice", () => {
  const selection = scoreTargetCandidates(
    { tagName: "button", visibleText: "Continue" },
    [CONTINUE_PRIMARY, CONTINUE_SECONDARY]
  );
  assert.equal(selection.outcome, "ambiguous");
  assert.equal(selection.ranked.length, 2);
  assert.equal(selection.ranked[0]?.score.normalizedScore, selection.ranked[1]?.score.normalizedScore);
});

test("a family with no identity in it is never a choice, however many candidates share it", () => {
  const byFamilyAlone = scoreTargetCandidates({ tagName: "button", implicitRole: "button" }, [CONTINUE_PRIMARY, CONTINUE_SECONDARY]);
  assert.equal(byFamilyAlone.outcome, "unmatched");
  assert.deepEqual(byFamilyAlone.ranked, []);
});

test("the least-wrong control on the page is refused, not clicked", () => {
  // Everything the recording knew this control by has changed: its text, its
  // id, its test id, its class and its selector. What is left on the page is
  // two buttons, neither of which is recognisably it.
  const drifted = scoreTargetCandidates({
    tagName: "button", implicitRole: "button", id: "save-settings", testId: "save-changes",
    selector: "#save-settings", classNames: ["btn", "btn-primary"],
    visibleText: "Save changes", accessibleName: "Save changes"
  }, [
    candidate("workspace-settings-submit", {
      tagName: "button", role: "button", id: "workspace-settings-submit", testId: "settings-submit",
      selector: "#workspace-settings-submit", classNames: ["ui-button", "ui-button--accent"],
      visibleText: "Apply changes", accessibleName: "Apply changes", isVisibleOnViewport: true
    }),
    candidate("discard-settings", {
      tagName: "button", role: "button", id: "discard-settings", testId: "discard-changes",
      selector: "#discard-settings", classNames: ["btn", "btn-secondary"],
      visibleText: "Discard changes", accessibleName: "Discard changes", isVisibleOnViewport: true
    })
  ]);
  assert.equal(drifted.outcome, "unmatched");
  assert.ok(drifted.ranked.length === 2, "the ranking is still reported, so a failure can say what it refused");
  assert.ok(
    (drifted.ranked[0]?.score.normalizedScore ?? 1) < TARGET_SCORE_FLOOR,
    `the best candidate scored ${drifted.ranked[0]?.score.normalizedScore}, which must be under the floor`
  );
});

test("a control recognisable by everything but its test id clears the floor", () => {
  const recovered = scoreTargetCandidates({
    tagName: "button", implicitRole: "button", id: "save-settings", testId: "save-changes",
    selector: "#save-settings", classNames: ["btn", "btn-primary"],
    visibleText: "Save changes", accessibleName: "Save changes"
  }, [
    candidate("save-settings", {
      tagName: "button", role: "button", id: "save-settings",
      selector: "#save-settings", classNames: ["btn", "btn-primary"],
      visibleText: "Save changes", accessibleName: "Save changes", isVisibleOnViewport: true
    }),
    candidate("discard-settings", {
      tagName: "button", role: "button", id: "discard-settings", testId: "discard-changes",
      selector: "#discard-settings", classNames: ["btn", "btn-secondary"],
      visibleText: "Discard changes", accessibleName: "Discard changes", isVisibleOnViewport: true
    })
  ]);
  assert.equal(recovered.outcome, "resolved");
  if (recovered.outcome !== "resolved") return;
  assert.equal(elementId(recovered.chosen.element), "save-settings");
  assert.ok(
    recovered.chosen.score.normalizedScore >= TARGET_SCORE_FLOOR,
    `the recovered control scored ${recovered.chosen.score.normalizedScore}`
  );
});

test("an empty pool is unmatched rather than an error", () => {
  const selection = scoreTargetCandidates({ id: "save-settings" }, []);
  assert.equal(selection.outcome, "unmatched");
  assert.deepEqual(selection.ranked, []);
});
