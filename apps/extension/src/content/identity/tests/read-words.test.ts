// A read step's words are its value, not its identity (`../read-words.ts`, t743 D2b), and how scoring uses them.
//
// Held on a library catalogue's loan summary, two paragraphs alike in tag and class:
// - a marked read splits into what decides it and the words it reads; a name beside different words stays deciding;
// - two candidates that match equally without the words are told apart by them;
// - a candidate whose words changed is not lowered: the one the rest of the identity chose still wins;
// - old words never choose another paragraph over the one the selector chose;
// - an unmarked target is scored exactly as before.

import assert from "node:assert/strict";
import test from "node:test";
import type { TargetCandidate } from "../candidates";
import { readWordsOf } from "../read-words";
import { scoreTargetCandidates, type RecordedIdentity } from "../score";

function candidate(candidateId: string, fingerprint: Omit<TargetCandidate["fingerprint"], "candidateId">): TargetCandidate {
  return { element: { candidateId } as unknown as Element, fingerprint: { candidateId, ...fingerprint } };
}

function elementId(element: Element): string {
  return (element as unknown as { candidateId: string }).candidateId;
}

const DUE = "#loans > p:nth-of-type(1)";
const FINES = "#loans > p:nth-of-type(2)";
const line = (id: string, selector: string, words: string): TargetCandidate =>
  candidate(id, { tagName: "p", role: "paragraph", selector, classNames: ["loan-line"], visibleText: words, isVisibleOnViewport: true });

test("a marked read splits into what decides it and the words it reads", () => {
  assert.equal(readWordsOf({ tagName: "p", visibleText: "Due 3 May" }), undefined, "an unmarked target is left alone");
  const plain = readWordsOf({ tagName: "p", selector: DUE, visibleText: "Due  3 May", accessibleName: "due 3 may", readsWords: true })!;
  assert.deepEqual(plain.unworded, { tagName: "p", selector: DUE });
  assert.deepEqual(plain.words, ["due 3 may"]);
  assert.equal(plain.agrees({ visibleText: "DUE 3 May" }), true);
  assert.equal(plain.agrees({ visibleText: "Due 10 May" }), false);
  const named = readWordsOf({ tagName: "p", visibleText: "Due 3 May", accessibleName: "Next due date", readsWords: true })!;
  assert.equal(named.unworded.accessibleName, "Next due date", "a name beside different words is the element's own");
  const alone = readWordsOf({ tagName: "p", accessibleName: "Due 3 May", readsWords: true })!;
  assert.equal(alone.unworded.accessibleName, undefined, "a name with no words beside it may be the words");
  assert.deepEqual(alone.words, ["due 3 may"]);
});

test("two candidates that match equally without the words are told apart by them", () => {
  // Saved with no selector a candidate answers, so tag, role and class tie the two paragraphs.
  const read: RecordedIdentity = { tagName: "p", implicitRole: "paragraph", selector: "#gone > p", classNames: ["loan-line"], visibleText: "Fines 0.00", readsWords: true };
  const pool = [line("due", DUE, "Due 3 May"), line("fines", FINES, "Fines 0.00")];
  const selection = scoreTargetCandidates(read, pool);
  assert.equal(selection.outcome, "resolved", JSON.stringify(selection.ranked.map((entry) => entry.score.normalizedScore)));
  if (selection.outcome !== "resolved") return;
  assert.equal(elementId(selection.chosen.element), "fines");
  // Neither words agree: still a tie, never a guess.
  const neither = scoreTargetCandidates({ ...read, visibleText: "Fines 2.50" }, pool);
  assert.notEqual(neither.outcome, "resolved");
});

test("a read whose words changed is found by its selector, and old words never choose another paragraph", () => {
  // The read's own paragraph now shows new words; the other one happens to show the old words.
  const read: RecordedIdentity = { tagName: "p", implicitRole: "paragraph", selector: DUE, classNames: ["loan-line"], visibleText: "Due 3 May", readsWords: true };
  const pool = [line("due", DUE, "Due 10 May"), line("fines", FINES, "Due 3 May")];
  const selection = scoreTargetCandidates(read, pool);
  assert.notEqual(selection.outcome, "resolved", "nothing but the words confirms either, so nothing is guessed");
  assert.equal(elementId(selection.ranked[0]!.element), "due", "the selector, not the words, ranks first");
  // With the words still agreeing the selector's paragraph resolves, as before.
  const same = scoreTargetCandidates(read, [line("due", DUE, "Due 3 May"), line("fines", FINES, "Fines 0.00")]);
  assert.equal(same.outcome, "resolved");
  if (same.outcome === "resolved") assert.equal(elementId(same.chosen.element), "due");
});

test("a read with a label besides its words is resolved by the label whatever its words now say", () => {
  const read: RecordedIdentity = { tagName: "p", implicitRole: "paragraph", selector: "#gone > p", label: "Next due date", visibleText: "Due 3 May", readsWords: true };
  const labelled = candidate("due", { tagName: "p", role: "paragraph", selector: DUE, label: "Next due date", visibleText: "Due 10 May", isVisibleOnViewport: true });
  const selection = scoreTargetCandidates(read, [labelled, line("fines", FINES, "Fines 0.00")]);
  assert.equal(selection.outcome, "resolved");
  if (selection.outcome === "resolved") assert.equal(elementId(selection.chosen.element), "due");
  // The same target unmarked is marked down for its changed words.
  const unmarked = scoreTargetCandidates({ ...read, readsWords: undefined }, [labelled, line("fines", FINES, "Fines 0.00")]);
  assert.ok(unmarked.ranked[0]!.score.normalizedScore < (selection.outcome === "resolved" ? selection.chosen.score.normalizedScore : 1));
});
