// T1 coverage of the predicate both acting paths put to a scored match before
// acting on it (design A, reports/i-resolver-safety.md "(a)"): something that
// says which control this is must agree with the recording exactly.
//
// Every row but the last is scored by Core's real matcher, through
// `scoreTargetCandidate`, because what decides the rule is the rung Core puts
// each comparison on -- 1.00 for identical text, 0.82 for one string containing
// the other in either direction -- and a hand-built contribution could state a
// rung Core never produces. The candidates carry a stand-in element: nothing on
// this path reads it.

import assert from "node:assert/strict";
import test from "node:test";
import type { ElementFingerprintScore } from "fluxiq/automation-studio/fingerprinting";
import type { TargetCandidate } from "../candidates";
import { corroboratesExactly } from "../corroboration";
import { TARGET_SCORE_FLOOR, scoreTargetCandidate, type RecordedIdentity } from "../score";

type Fingerprint = Omit<TargetCandidate["fingerprint"], "candidateId">;

function candidate(candidateId: string, fingerprint: Fingerprint): TargetCandidate {
  return { element: { candidateId } as unknown as Element, fingerprint: { candidateId, ...fingerprint } };
}

/** A visible button, named from its content unless a name is given. */
function button(candidateId: string, text: string, name = text, extra: Partial<Fingerprint> = {}): TargetCandidate {
  return candidate(candidateId, { tagName: "button", role: "button", visibleText: text, accessibleName: name, isVisibleOnViewport: true, ...extra });
}

function scored(recorded: RecordedIdentity, entry: TargetCandidate): ElementFingerprintScore {
  const score = scoreTargetCandidate(recorded, entry);
  assert.ok(score, "the recording carries identity, so Core must return a score");
  return score;
}

/** The similarity Core charged one signal: its contribution's score over its weight. */
function rung(score: ElementFingerprintScore, signal: string): number | undefined {
  const contribution = [...score.positiveContributions, ...score.negativeContributions].find((entry) => entry.signalPath === signal);
  return contribution ? contribution.score / contribution.weight : undefined;
}

/** The identity-drift Save, recorded on a page that gave it no id and no test id. */
const SAVE: RecordedIdentity = {
  tagName: "button", implicitRole: "button",
  selector: "main > form > section:nth-of-type(1) > div > button:nth-of-type(1)", classNames: ["btn", "btn-primary"],
  visibleText: "Save changes", accessibleName: "Save changes"
};

test("the recorded label, word for word, corroborates", () => {
  assert.equal(corroboratesExactly(scored(SAVE, button("save", "Save changes"))), true);
});

test("a different action whose label contains the recorded one does not, though Core counts it as agreement", () => {
  const score = scored(SAVE, button("exit", "Save changes and exit"));
  // Core's partial rung, and a positive contribution: what the veto's first rule accepted.
  assert.equal(rung(score, "visibleText"), 0.82);
  assert.ok(score.positiveContributions.some((entry) => entry.signalPath === "visibleText"));
  assert.ok(score.normalizedScore >= TARGET_SCORE_FLOOR, `scored ${score.normalizedScore}: over the floor, so only this rule refuses it`);
  assert.equal(corroboratesExactly(score), false);
});

test("the recorded control shortened to fit scores the same as the different action, and is refused alike", () => {
  const shortened = scored(SAVE, button("save-short", "Save"));
  const different = scored(SAVE, button("exit", "Save changes and exit"));
  assert.equal(shortened.normalizedScore, different.normalizedScore);
  assert.equal(corroboratesExactly(shortened), false);
});

test("an accessible name kept exactly corroborates while the visible text changed", () => {
  // `reworded-aria`: the button now reads "Save" and its aria-label still says "Save changes".
  assert.equal(corroboratesExactly(scored(SAVE, button("reworded", "Save", "Save changes"))), true);
});

test("a label corroborates like the text and the name, and only when it is the same label", () => {
  const email: RecordedIdentity = { tagName: "input", implicitRole: "textbox", label: "Work email" };
  const input = (candidateId: string, label: string) => candidate(candidateId, { tagName: "input", role: "textbox", label, isVisibleOnViewport: true });
  assert.equal(corroboratesExactly(scored(email, input("work", "Work email"))), true);
  assert.equal(corroboratesExactly(scored(email, input("personal", "Work email (personal)"))), false);
});

test("an equal id or test id corroborates with every word changed; a different or missing one does not", () => {
  const recorded: RecordedIdentity = { tagName: "button", implicitRole: "button", id: "save-settings", testId: "save-changes", visibleText: "Save changes" };
  assert.equal(corroboratesExactly(scored(recorded, button("by-id", "Apply", "Apply", { id: "save-settings" }))), true);
  assert.equal(corroboratesExactly(scored(recorded, button("by-test-id", "Apply", "Apply", { testId: "save-changes" }))), true);
  assert.equal(corroboratesExactly(scored(recorded, button("other", "Apply", "Apply", { id: "exit-btn", testId: "save-and-exit" }))), false);
  assert.equal(corroboratesExactly(scored(recorded, button("bare", "Apply"))), false);
});

test("structure never corroborates, however completely it agrees", () => {
  // Tag, role, selector, class set and visibility all exact: everything a weak
  // query or a crowded family can agree on, and none of it says which control.
  const recorded: RecordedIdentity = { tagName: "button", implicitRole: "button", selector: "main > div > button", classNames: ["btn", "btn-primary"] };
  const score = scored(recorded, candidate("icon", {
    tagName: "button", role: "button", selector: "main > div > button", classNames: ["btn", "btn-primary"], isVisibleOnViewport: true
  }));
  assert.equal(score.normalizedScore, 1);
  assert.equal(corroboratesExactly(score), false);
});

test("a contribution with no weight never corroborates", () => {
  // Core lets a caller zero a weight; nought over nought must not read as agreement.
  const weightless = {
    positiveContributions: [{ signalPath: "visibleText", score: 0, weight: 0, reason: "text matched exactly" }]
  } as unknown as ElementFingerprintScore;
  assert.equal(corroboratesExactly(weightless), false);
});
