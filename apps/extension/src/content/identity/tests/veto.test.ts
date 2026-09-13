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
// **And the separation is now pinned on a second axis, the one that was
// missing.** Every row above holds the *recording* fixed at a descriptor
// carrying an id and a test id, which is where most of the negative weight
// comes from; over an enumeration that varies the recording instead, the score
// alone separates for only 3 of 16 recording classes. `THIN_RECORDINGS` below
// is that finding in three rows: an impostor that answers nothing the recording
// named scores *above* the threshold against a thinner recording, and is
// refused by the corroboration rule rather than by the score.
// reports/L-veto-recordings.md has the enumeration.
//
// `score.ts` and `veto.ts` never touch the DOM on this path, so the candidates
// carry a stand-in element; `vetoExactMatch` reads one only after its
// precondition passes, which is why the precondition row can pass a bare object.

import assert from "node:assert/strict";
import test from "node:test";
import type { TargetCandidate } from "../candidates";
import { TARGET_SCORE_FLOOR, scoreTargetCandidate, type RecordedIdentity } from "../score";
import { TARGET_VETO_FLOOR, vetoCandidate, vetoExactMatch } from "../veto";

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
    // Neither rule may take it away, so the whole policy is asserted and not
    // only the number the first rule reads -- and the verdict must carry the
    // measurement out with it, because an accepted match's confidence is what
    // the resolution reports.
    const verdict = vetoCandidate(RECORDED, drifted.candidate);
    assert.equal(verdict.refusedBecause, undefined);
    assert.equal(verdict.measurement?.score, score);
    assert.equal(typeof verdict.measurement?.confidence, "number");
  });
}

for (const impostor of IMPOSTORS) {
  test(`the veto refuses an impostor: ${impostor.name}`, () => {
    const score = normalized(RECORDED, impostor.candidate);
    assert.ok(
      score < TARGET_VETO_FLOOR,
      `${impostor.candidate.fingerprint.candidateId} scored ${score}, at or over the veto floor of ${TARGET_VETO_FLOOR}`
    );
    const verdict = vetoCandidate(RECORDED, impostor.candidate);
    assert.equal(verdict.refusedBecause, "contradicted");
    assert.equal(verdict.measurement?.score, score);
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

test("a recording that names nothing cannot be checked, so nothing is vetoed", () => {
  // The veto reads its element only after this precondition passes, so a bare
  // object here is proof that it returned before touching the DOM -- which is
  // also what keeps a descriptor carrying only a selector working unchanged.
  const element = {} as Element;
  // Nothing weighed, so nothing refused and nothing measured -- the resolution
  // then reports a strategy and a count and claims no score it never took.
  for (const target of [{ selector: "#save-settings" }, { classNames: ["btn", "btn-primary"] }, { visibleText: "   " }]) {
    assert.deepEqual(vetoExactMatch(target, element), {});
  }
});

test("no candidate is scored against a recording with no identity in it", () => {
  assert.equal(scoreTargetCandidate({ tagName: "button" }, IMPOSTORS[0]!.candidate), undefined);
});

/**
 * The second axis, and the one the first proof left out.
 *
 * Everything above holds the recording at `RECORDED`, whose id and test id
 * supply most of the negative weight an impostor collects. `normalizedScore`
 * divides by the weight of the signals the *recording* carried, so a thinner
 * recording loses that weight from the numerator and the denominator at once
 * and the same impostor lands on the other side of the threshold. These rows
 * pin that, and pin which rule catches it. reports/L-veto-recordings.md.
 */
const THIN_RECORDINGS = [
  {
    name: "no id and no test id -- the ordinary case, where the class set is the query that fires",
    // `selectorFor` falls back to a structural path when the page offers no
    // author-supplied identifier, so that is what a recording of this control
    // actually carries. Measured: this impostor scores +0.010.
    recorded: {
      tagName: "button", implicitRole: "button",
      selector: "main > div:nth-of-type(2) > button:nth-of-type(1)",
      classNames: ["btn", "btn-primary"],
      visibleText: "Save changes", accessibleName: "Save changes"
    } satisfies RecordedIdentity
  },
  {
    name: "identifiers but no label -- an icon button the page names only by its test id",
    // Measured: +0.182. Before the corroboration rule the veto did not even run
    // here, because its precondition asked only for a recorded label.
    recorded: {
      tagName: "button", implicitRole: "button", id: "save-settings", testId: "save-changes",
      selector: "#save-settings", classNames: ["btn", "btn-primary"]
    } satisfies RecordedIdentity
  }
];

/** The impostor a weak query lands on when nothing of the recording survives. */
const NAMELESS_IMPOSTOR = IMPOSTORS[2]!.candidate;

for (const thin of THIN_RECORDINGS) {
  test(`the score alone does not separate a thin recording: ${thin.name}`, () => {
    // The finding first, so this row fails if the exposure ever closes by some
    // other route and the rule below stops being the thing that catches it.
    const score = normalized(thin.recorded, NAMELESS_IMPOSTOR);
    assert.ok(
      score >= TARGET_VETO_FLOOR,
      `this row exists because ${score} is on the acting side of ${TARGET_VETO_FLOOR}; if it is not, the second rule is no longer load-bearing here`
    );
    assert.equal(vetoCandidate(thin.recorded, NAMELESS_IMPOSTOR).refusedBecause, "uncorroborated");
  });
}

test("corroboration costs a drifted control nothing: the label is itself the corroboration", () => {
  // The two drift shapes a recording with no identifiers can still be found by:
  // the text standing while everything else moved, and the class set standing
  // while the label was shortened. Both keep a text signal, so both corroborate
  // -- which is why the rule refuses no profile whose label agrees.
  const thin = THIN_RECORDINGS[0]!.recorded;
  for (const drifted of [DRIFTED[0]!, DRIFTED[3]!]) {
    assert.equal(vetoCandidate(thin, drifted.candidate).refusedBecause, undefined, `${drifted.name} was refused against a recording with no identifiers`);
  }
});

test("a recording that names nothing at all is the limit, and it is a decision", () => {
  // No text, no name, no id, no test id: the recording asked no question a
  // candidate could answer, so refusing would only be the class-set strategy
  // disagreeing with itself. Measured, an impostor reaches +0.563 here and
  // Level 2 would resolve it too. Named in D14 rather than closed; this row is
  // what makes reopening it a deliberate act.
  const namesNothing: RecordedIdentity = {
    tagName: "button", implicitRole: "button",
    selector: "main > div:nth-of-type(2) > button:nth-of-type(1)",
    classNames: ["btn", "btn-primary"]
  };
  assert.deepEqual(vetoCandidate(namesNothing, NAMELESS_IMPOSTOR), {});
});

test("an accepted match hands back what Core measured, and nothing that came off the page", () => {
  // The accepted path ends on a successful action result, which nothing
  // redacts, so what the veto returns there has to be numbers only. This row is
  // that rule as a check rather than a comment: two numeric fields, no third
  // field, no string. `resolve-target.ts` reads exactly these two onto
  // `bestScore` and `confidence`.
  const verdict = vetoCandidate(RECORDED, DRIFTED[2]!.candidate);
  assert.equal(verdict.refusedBecause, undefined);
  assert.ok(verdict.measurement, "an accepted match keeps the score the veto took of it");
  assert.deepEqual(Object.keys(verdict.measurement).sort(), ["confidence", "score"]);
  for (const value of Object.values(verdict.measurement)) assert.equal(typeof value, "number");
});

/**
 * Rule 2 is exact now (`corroboration.ts`). The production wrong action is a
 * label that contains the recorded one, and Core puts that on a positive rung,
 * so the rule as first written accepted it: a Level 1 match on "Save changes
 * and exit" was clicked at 0.633 (reports/i-resolver-safety.md, R3). Each row
 * asserts the score is on the acting side of rule 1 first, so that rule 2 alone
 * has to refuse it.
 */
const PARTIAL_LABEL_IMPOSTORS = [
  {
    name: "a different action wearing the recorded class set, with no identifiers",
    candidate: candidate("exit-bare", {
      tagName: "button", role: "button", classNames: ["btn", "btn-primary"],
      visibleText: "Save changes and exit", accessibleName: "Save changes and exit", isVisibleOnViewport: true
    })
  },
  {
    name: "the same action with an id and a test id of its own",
    candidate: candidate("exit-btn", {
      tagName: "button", role: "button", id: "exit-btn", testId: "save-and-exit", selector: "#exit-btn",
      visibleText: "Save changes and exit", accessibleName: "Save changes and exit", isVisibleOnViewport: true
    })
  }
];

for (const recording of [{ name: "an authored recording", recorded: RECORDED }, { name: "a recording with no identifiers", recorded: THIN_RECORDINGS[0]!.recorded }]) {
  for (const impostor of PARTIAL_LABEL_IMPOSTORS) {
    test(`rule 2 refuses a partial-label wrong action: ${impostor.name}, against ${recording.name}`, () => {
      const score = normalized(recording.recorded, impostor.candidate);
      assert.ok(score >= TARGET_VETO_FLOOR, `${score} is under the veto floor, so rule 1 refuses this and the row no longer tests rule 2`);
      assert.equal(vetoCandidate(recording.recorded, impostor.candidate).refusedBecause, "uncorroborated");
    });
  }
}

test("the line is exactness: a shortened label with its name kept acts, and shortened in both does not", () => {
  // The first half is `DRIFTED[3]`, kept above. The second is the cost the exact
  // rule accepts, because it scores like the different action does.
  const shortenedInBoth = candidate("save-short", {
    tagName: "button", role: "button", classNames: ["btn", "btn-primary"], visibleText: "Save", accessibleName: "Save", isVisibleOnViewport: true
  });
  assert.equal(vetoCandidate(RECORDED, DRIFTED[3]!.candidate).refusedBecause, undefined);
  assert.ok(normalized(RECORDED, shortenedInBoth) >= TARGET_VETO_FLOOR);
  assert.equal(vetoCandidate(RECORDED, shortenedInBoth).refusedBecause, "uncorroborated");
});
