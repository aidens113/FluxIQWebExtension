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

// Design A: a winner nothing distinguishing agrees with exactly is not an
// answer (`corroboration.ts`, reports/i-resolver-safety.md "(a)"). The two
// recordings are the identity-drift Save as an authored page and as a page with
// no identifiers records it; the candidates are the shapes the probe measured.
// A refused row that clears the floor says so first: those rows are refused by
// the new rule alone, and they are the rows that fail with `resolved` when the
// rule is bypassed.

const AUTHORED_SAVE = {
  tagName: "button", implicitRole: "button", id: "save-settings", testId: "save-changes",
  selector: "#save-settings", classNames: ["btn", "btn-primary"],
  visibleText: "Save changes", accessibleName: "Save changes"
};
const IDENTIFIER_LESS_SAVE = {
  tagName: "button", implicitRole: "button",
  selector: "main > form > section:nth-of-type(1) > div > button:nth-of-type(1)", classNames: ["btn", "btn-primary"],
  visibleText: "Save changes", accessibleName: "Save changes"
};
/** A different action whose label contains the recorded one, with an id and a test id of its own (R1-R4). */
const EXIT_WITH_IDS = candidate("exit-btn", {
  tagName: "button", role: "button", id: "exit-btn", testId: "save-and-exit", selector: "#exit-btn",
  visibleText: "Save changes and exit", accessibleName: "Save changes and exit", isVisibleOnViewport: true
});
/** The same different action carrying no identifiers (R7-R8). */
const EXIT_BARE = candidate("exit-bare", {
  tagName: "button", role: "button", visibleText: "Save changes and exit", accessibleName: "Save changes and exit", isVisibleOnViewport: true
});
/** `reworded-aria`: the visible text shortened, the aria-label kept. */
const REWORDED = candidate("reworded", {
  tagName: "button", role: "button", classNames: ["ui-button"], visibleText: "Save", accessibleName: "Save changes", isVisibleOnViewport: true
});
const DISCARD = candidate("discard-settings", {
  tagName: "button", role: "button", id: "discard-settings", testId: "discard-changes",
  selector: "#discard-settings", classNames: ["btn", "btn-secondary"],
  visibleText: "Discard changes", accessibleName: "Discard changes", isVisibleOnViewport: true
});

for (const row of [
  { name: "a recording with no identifiers, the near-miss with ids of its own alone (R2)", recorded: IDENTIFIER_LESS_SAVE, pool: [EXIT_WITH_IDS], clearsFloor: true },
  { name: "a recording with no identifiers, the near-miss with no ids alone", recorded: IDENTIFIER_LESS_SAVE, pool: [EXIT_BARE], clearsFloor: true },
  { name: "a recording with no identifiers, the near-miss far ahead of Discard (R4)", recorded: IDENTIFIER_LESS_SAVE, pool: [EXIT_WITH_IDS, DISCARD], clearsFloor: true },
  { name: "an authored recording, the near-miss with no ids alone (R7)", recorded: AUTHORED_SAVE, pool: [EXIT_BARE], clearsFloor: true },
  { name: "an authored recording, the near-miss with no ids far ahead of Discard (R8)", recorded: AUTHORED_SAVE, pool: [EXIT_BARE, DISCARD], clearsFloor: true },
  { name: "an authored recording, the near-miss whose ids contradict it (R1)", recorded: AUTHORED_SAVE, pool: [EXIT_WITH_IDS], clearsFloor: false }
]) {
  test(`a different action with a containing label is refused: ${row.name}`, () => {
    const selection = scoreTargetCandidates(row.recorded, row.pool);
    const best = selection.ranked[0]?.score.normalizedScore ?? -1;
    assert.equal(best >= TARGET_SCORE_FLOOR, row.clearsFloor, `the near-miss scored ${best}`);
    assert.equal(selection.outcome, "unmatched", `the near-miss at ${best} was ${selection.outcome}`);
  });
}

test("reworded-aria still resolves on both recordings, because its name agrees exactly", () => {
  for (const recorded of [AUTHORED_SAVE, IDENTIFIER_LESS_SAVE]) {
    const selection = scoreTargetCandidates(recorded, [REWORDED, DISCARD]);
    assert.equal(selection.outcome, "resolved");
    if (selection.outcome !== "resolved") continue;
    assert.equal(elementId(selection.chosen.element), "reworded");
  }
});

test("the accepted cost: Save shortened to \"Save\" scores what the different action scores, and is refused with it (R9)", () => {
  const shortened = candidate("save-short", {
    tagName: "button", role: "button", visibleText: "Save", accessibleName: "Save", isVisibleOnViewport: true
  });
  const refused = scoreTargetCandidates(AUTHORED_SAVE, [shortened]);
  const different = scoreTargetCandidates(AUTHORED_SAVE, [EXIT_BARE]);
  assert.equal(refused.ranked[0]?.score.normalizedScore, different.ranked[0]?.score.normalizedScore);
  assert.equal(refused.outcome, "unmatched");
});

test("two uncorroborated candidates that tie are still reported as a tie", () => {
  // The rule is checked after the margin, so it turns no ambiguous page into a not-found one.
  const twin = candidate("exit-bare-twin", {
    tagName: "button", role: "button", visibleText: "Save changes and exit", accessibleName: "Save changes and exit", isVisibleOnViewport: true
  });
  assert.equal(scoreTargetCandidates(IDENTIFIER_LESS_SAVE, [EXIT_BARE, twin]).outcome, "ambiguous");
});
