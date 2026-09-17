import assert from "node:assert/strict";
import test from "node:test";
import { scoreTargetCandidate, scoreTargetCandidates, type RecordedIdentity } from "../score";
import { TARGET_VETO_FLOOR, vetoCandidate } from "../veto";

// Rule 0: the row, and the one impostor the other two rules cannot refuse.
//
// `veto.test.ts` beside this one varies what a control *is*, over two
// populations and sixteen recording classes. This file varies nothing at all:
// the candidate is the recorded control's identical twin, because the page
// renders 240 of them from one template and every signal agrees exactly. Rule 1
// scores it at the top of the scale and rule 2 finds the accessible name
// agreeing exactly, so both accept -- which is how a replay clicked another
// member's row action and reported the wrong promotion as a success.
//
// The rows here are the gate that refuses it, at both acting paths: the Level 1
// veto, and the Level 2 ranking, which must not rank an ineligible candidate
// even when it would win. The rule itself -- what counts as a record and what
// identifies one -- is pinned in `record.test.ts`, and the whole resolution is
// in `action-runtime/tests/wrong-row-resolution.test.ts`.

/** A directory row and its action button, shaped as the fixture renders them. */
function directoryRow(memberId: string): { row: Element; action: Element } {
  const action = {
    localName: "button", tagName: "BUTTON", parentElement: null as Element | null,
    getAttribute: () => null, getAttributeNames: (): string[] => [], matches: (selector: string) => selector.includes("button"),
    childNodes: [], children: []
  };
  const attributes: Record<string, string> = { "data-member-id": memberId };
  const row = {
    localName: "tr", tagName: "TR", parentElement: null as Element | null,
    getAttribute: (name: string) => attributes[name] ?? null,
    getAttributeNames: () => Object.keys(attributes),
    matches: (selector: string) => selector.includes("tr"),
    childNodes: [], children: []
  };
  action.parentElement = row as unknown as Element;
  return { row: row as unknown as Element, action: action as unknown as Element };
}

/** The recorded row action: no id, no test id, the design system's constant name, a generated class. */
const ROW_ACTION: RecordedIdentity = {
  tagName: "button", implicitRole: "button", role: "button",
  classNames: ["x1f4a"], accessibleName: "Row actions", visibleText: "Row actions",
  context: { record: { keyAttribute: "data-member-id", key: "usr_a91" } }
};

/** Its twin, as `candidateFingerprint` describes any of the other 239. */
const ROW_ACTION_TWIN = {
  tagName: "button", role: "button", classNames: ["x1f4a"],
  visibleText: "Row actions", accessibleName: "Row actions", isVisibleOnViewport: true
};

test("rule 0 refuses the recorded control's identical twin in another row", () => {
  const twin = { element: directoryRow("usr_b17").action, fingerprint: { candidateId: "twin", ...ROW_ACTION_TWIN } };
  // The two rules above cannot help here, and the row asserts that rather than
  // assuming it: the twin scores at the top of the scale and corroborates
  // exactly, because it is the same control rendered for someone else.
  const score = scoreTargetCandidate({ ...ROW_ACTION, context: undefined }, twin);
  assert.ok(score && score.normalizedScore >= TARGET_VETO_FLOOR, "the score alone accepts this candidate");
  assert.equal(vetoCandidate({ ...ROW_ACTION, context: undefined }, twin).refusedBecause, undefined);

  assert.equal(vetoCandidate(ROW_ACTION, twin).refusedBecause, "other-record");
});

test("rule 0 keeps the same control in the recorded row", () => {
  const same = { element: directoryRow("usr_a91").action, fingerprint: { candidateId: "same", ...ROW_ACTION_TWIN } };
  assert.equal(vetoCandidate(ROW_ACTION, same).refusedBecause, undefined);
});

test("a candidate in another row is not ranked, so the fallback cannot choose it either", () => {
  const twin = { element: directoryRow("usr_b17").action, fingerprint: { candidateId: "twin", ...ROW_ACTION_TWIN } };
  const same = { element: directoryRow("usr_a91").action, fingerprint: { candidateId: "same", ...ROW_ACTION_TWIN } };

  assert.equal(scoreTargetCandidates(ROW_ACTION, [twin]).outcome, "unmatched", "the wrong row must not be the answer when it is the only candidate left");
  const chosen = scoreTargetCandidates(ROW_ACTION, [twin, same]);
  assert.equal(chosen.outcome, "resolved");
  assert.equal(chosen.outcome === "resolved" ? chosen.chosen.element : undefined, same.element);
  assert.equal(chosen.ranked.length, 1, "the ineligible twin is not ranked, so it cannot tie with the recorded row either");
});
