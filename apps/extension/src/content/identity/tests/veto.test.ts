// T1 coverage of the veto that stops Level 1 acting on evidence Level 2 would
// reject (the Level 1 safety gate).
//
// What is pinned here is the **separation**, not a number. The veto is one
// constant, and a constant is only ever as good as the distance between the two
// populations it sits between: the drifted controls a replay must still find,
// and the impostors a weak query lands on. Both populations are below, shaped
// exactly as `candidateFingerprint` describes them on the real identity-drift
// page -- the scores were measured in Chromium first and the shapes copied back
// -- and every row asserts only which side of the veto its candidate falls on.
//
// So this file fails if Core's weights ever move far enough to collapse the
// separation, which is the thing that actually matters and the thing no
// exact-value assertion would catch (an exact value fails on any change at all,
// including harmless ones, and gets updated without thought). It already earned
// that: Core's missing-identifier penalty changed from -0.55 to -0.1 while this
// gate was being built, which moved every impostor here 0.17 closer to the line
// and left the separation intact. reports/v-level1-veto.md has both tables.
//
// `score.ts` and `veto.ts` never touch the DOM on this path, so the candidates
// carry a stand-in element; `vetoExactMatch` reads one only after its
// precondition passes, which is why the precondition row can pass a bare object.

import assert from "node:assert/strict";
import test from "node:test";
import type { TargetCandidate } from "../candidates";
import { TARGET_SCORE_FLOOR, scoreTargetCandidate, type RecordedIdentity } from "../score";
import { TARGET_VETO_FLOOR, vetoExactMatch } from "../veto";

/** A candidate whose element is a marker: nothing on this path reads it. */
function candidate(candidateId: string, fingerprint: Omit<TargetCandidate["fingerprint"], "candidateId">): TargetCandidate {
  return { element: { candidateId } as unknown as Element, fingerprint: { candidateId, ...fingerprint } };
}

/** The identity-drift Save button as the recording captured it. */
const RECORDED: RecordedIdentity = {
  tagName: "button", implicitRole: "button", id: "save-settings", testId: "save-changes",
  selector: "#save-settings", classNames: ["btn", "btn-primary"],
  visibleText: "Save changes", accessibleName: "Save changes"
};

/**
 * The controls a replay must still find. Every one of these is resolved by a
 * Level 1 strategy today, and the veto must not take any of them away: they are
 * the drift recovery the resolver exists for.
 */
const DRIFTED = [
  {
    name: "selector-only -- id, test id and class all changed; only the text stands",
    // Resolved by the fingerprint's exact-text query, with both identifiers
    // actively contradicting. The tightest correct case there is.
    candidate: candidate("workspace-settings-submit", {
      tagName: "button", role: "button", id: "workspace-settings-submit", testId: "settings-submit",
      selector: "#workspace-settings-submit", classNames: ["ui-button", "ui-button--accent"],
      visibleText: "Save changes", accessibleName: "Save changes", isVisibleOnViewport: true
    })
  },
  {
    name: "text-only -- the label changed; the id stands",
    candidate: candidate("save-settings", {
      tagName: "button", role: "button", id: "save-settings", selector: "#save-settings",
      classNames: ["btn", "btn-primary"], visibleText: "Apply changes", accessibleName: "Apply changes",
      isVisibleOnViewport: true
    })
  },
  {
    name: "moved / wrapped-aria -- the test id is gone and everything else stands",
    candidate: candidate("save-settings", {
      tagName: "button", role: "button", id: "save-settings", selector: "#save-settings",
      classNames: ["btn", "btn-primary"], visibleText: "Save changes", accessibleName: "Save changes",
      isVisibleOnViewport: true
    })
  },
  {
    name: "the class set kept, the label shortened to fit a narrower button",
    candidate: candidate("save", {
      tagName: "button", role: "button", classNames: ["btn", "btn-primary"],
      visibleText: "Save", accessibleName: "Save changes", isVisibleOnViewport: true
    })
  }
];

/**
 * What a weak Level 1 query lands on when the recorded control is gone. Each of
 * these is *resolved and clicked* without the veto, because `btn btn-primary`
 * is one of the commonest class pairs on the web and the class-set query does
 * not ask what the button says.
 */
const IMPOSTORS = [
  {
    name: "the recorded class set on a destructive control",
    candidate: candidate("delete", {
      tagName: "button", role: "button", classNames: ["btn", "btn-primary"],
      visibleText: "Delete workspace", accessibleName: "Delete workspace", isVisibleOnViewport: true
    })
  },
  {
    name: "the recorded class set on an unrelated control",
    candidate: candidate("invite", {
      tagName: "button", role: "button", classNames: ["btn", "btn-primary"],
      visibleText: "Invite members", accessibleName: "Invite members", isVisibleOnViewport: true
    })
  },
  {
    name: "the recorded class set on a button with no name at all",
    candidate: candidate("icon", {
      tagName: "button", role: "button", classNames: ["btn", "btn-primary"], isVisibleOnViewport: true
    })
  },
  {
    name: "a structural path landing on the control next to the recorded one",
    candidate: candidate("discard-settings", {
      tagName: "button", role: "button", id: "discard-settings", testId: "discard-changes",
      selector: "#discard-settings", classNames: ["btn", "btn-secondary"],
      visibleText: "Discard changes", accessibleName: "Discard changes", isVisibleOnViewport: true
    })
  }
];

function normalized(target: RecordedIdentity, entry: TargetCandidate): number {
  const score = scoreTargetCandidate(target, entry);
  assert.ok(score, "the recorded control carries identity, so Core must return a score");
  return score.normalizedScore;
}

for (const drifted of DRIFTED) {
  test(`the veto keeps a drifted control: ${drifted.name}`, () => {
    const score = normalized(RECORDED, drifted.candidate);
    assert.ok(
      score >= TARGET_VETO_FLOOR,
      `${drifted.candidate.fingerprint.candidateId} scored ${score}, under the veto floor of ${TARGET_VETO_FLOOR}`
    );
  });
}

for (const impostor of IMPOSTORS) {
  test(`the veto refuses an impostor: ${impostor.name}`, () => {
    const score = normalized(RECORDED, impostor.candidate);
    assert.ok(
      score < TARGET_VETO_FLOOR,
      `${impostor.candidate.fingerprint.candidateId} scored ${score}, at or over the veto floor of ${TARGET_VETO_FLOOR}`
    );
  });
}

test("the two populations do not merely straddle the line, they are separated by it", () => {
  const worstDrift = Math.min(...DRIFTED.map((entry) => normalized(RECORDED, entry.candidate)));
  const bestImpostor = Math.max(...IMPOSTORS.map((entry) => normalized(RECORDED, entry.candidate)));
  assert.ok(
    bestImpostor < TARGET_VETO_FLOOR && TARGET_VETO_FLOOR <= worstDrift,
    `the veto floor ${TARGET_VETO_FLOOR} must lie in (${bestImpostor}, ${worstDrift}]`
  );
});

test("the veto is a rejection question, so its threshold is not the selection floor", () => {
  // The floor asks "is this good enough to choose from several?"; the veto asks
  // "is this so wrong that acting would be dangerous?". Setting them equal
  // refuses `selector-only` at 0.149 and `text-only` -- the drift recovery the
  // exit criterion depends on -- so the two constants must stay apart.
  assert.ok(TARGET_VETO_FLOOR < TARGET_SCORE_FLOOR, "a veto at the selection floor would refuse the drift modes");
  const worstDrift = Math.min(...DRIFTED.map((entry) => normalized(RECORDED, entry.candidate)));
  assert.ok(worstDrift < TARGET_SCORE_FLOOR, `a drift case scoring ${worstDrift} is exactly what the floor refuses and the veto must not`);
});

test("a recording that captured no label cannot be checked, so nothing is vetoed", () => {
  // The veto reads its element only after this precondition passes, so a bare
  // object here is proof that it returned before touching the DOM -- which is
  // also what keeps a descriptor carrying only a selector working unchanged.
  const element = {} as Element;
  assert.equal(vetoExactMatch({ selector: "#save-settings" }, element), undefined);
  assert.equal(vetoExactMatch({ id: "save-settings", testId: "save-changes" }, element), undefined);
  assert.equal(vetoExactMatch({ visibleText: "   " }, element), undefined);
});

test("no candidate is scored against a recording with no identity in it", () => {
  assert.equal(scoreTargetCandidate({ tagName: "button" }, IMPOSTORS[0]!.candidate), undefined);
});
