import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { parseRunEvaluationJson, type ExpectedPersonHandOff } from "@fluxiq-web-extension/test-contracts";
import type { RunLaneObservation } from "../../flow-lane/index.js";
import type { PersonHandOff, PersonHandOffSnapshot } from "../../person-simulation/index.js";
import { evaluateObservedRun, type ObservedRun } from "../observed-run-evaluation.js";
import { personHandOffEvidence, type PersonHandOffEvidence } from "../person-hand-off-evidence.js";
import { personHandOffInvariant } from "../person-hand-off-invariant.js";

const REQUIRED: ExpectedPersonHandOff = { person: "completes", required: true, because: "The store answers every page with its check until a person passes it." };
const identity: ObservedRun["identity"] = { scenarioId: "everything-store", workflowId: "first-page-earbuds", variantId: "robot-check", repeatIndex: 0, expectedFailure: null };
const passedOutcome: ObservedRun["outcome"] = { runId: "run-a", verdict: "passed", invariants: [{ id: "runner-verdict", passed: true, expected: "passed", actual: "passed", evidenceSequences: [9] }], metrics: {}, durationMs: 1_000 };
const flow: RunLaneObservation = { lane: "flow", flowCreated: true, oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null, harnessActivations: 0, actions: [], extraction: null };

const handOff = (overrides: Partial<PersonHandOff> = {}): PersonHandOff => ({
  askId: "ask-1", stage: "run", subject: { kind: "run", id: "run-core-1" }, scenarioId: "everything-store",
  check: "type-the-characters", did: "cleared", cleared: true, answer: "person_done", secondsWaited: 6.2, note: null, ...overrides,
});
const read = (handOffs: PersonHandOff[], expected: ExpectedPersonHandOff | null = REQUIRED, extra: Partial<PersonHandOffSnapshot> = {}): PersonHandOffEvidence =>
  ({ status: "read", snapshot: { scenarioId: "everything-store", expected, playable: true, handOffs, pollFailures: 0, lastPollFailure: null, ...extra } });
const evaluate = (personHandOffs: PersonHandOffEvidence, outcome = passedOutcome) => evaluateObservedRun({ identity, facilityFailure: null, outcome, observation: flow, personHandOffs });

test("a hand-off at a real check, cleared by the person, is correct: the run keeps its pass and says so", () => {
  const evaluation = evaluate(read([handOff()]));
  assert.equal(evaluation.verdict, "passed");
  const invariant = evaluation.invariants.find(({ id }) => id === "person-hand-off");
  assert.equal(invariant?.passed, true);
  assert.equal(invariant?.actual, "1 hand-off(s): type-the-characters at run, cleared after 6.2 s");
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(evaluation)), evaluation);
});

test("an undeclared hand-off at a real check still passes, and is named as undeclared", () => {
  const invariant = personHandOffInvariant(read([handOff({ stage: "build", subject: { kind: "flow", id: "flow-1" } })], null));
  assert.equal(invariant?.passed, true);
  assert.match(invariant?.actual ?? "", /at build, cleared.*declares none, and a hand-off at a real check is still correct/u);
});

test("a hand-off where no check stood fails a run the runner passed, as runtime.behavior", () => {
  const evaluation = evaluate(read([handOff({ check: null, did: "no-check-visible", cleared: false, answer: "person_stop", note: "no tab of the scenario showed a check the Lab knows" })], null));
  assert.deepEqual([evaluation.verdict, evaluation.failureCategory], ["failed", "runtime.behavior"]);
  assert.match(evaluation.invariants.find(({ id }) => id === "person-hand-off")?.actual ?? "", /1 hand-off\(s\) where no check the Lab knows was showing \(run\)/u);
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(evaluation)), evaluation);
});

test("a row that requires a hand-off fails without one, and says when the Lab could not read Core's threads", () => {
  const invariant = personHandOffInvariant(read([], REQUIRED, { pollFailures: 2, lastPollFailure: "Automation Studio call failed: list-conversations" }));
  assert.equal(invariant?.passed, false);
  assert.match(invariant?.actual ?? "", /^no hand-off: FluxIQ met the check without asking a person, or never reached it; the Lab could not read Core's threads 2 time\(s\)/u);
});

test("a check that already shows the automation's hand, or one the Lab could not play, fails the invariant", () => {
  const tampered = personHandOffInvariant(read([handOff({ did: "declined-tampered", cleared: false, answer: "person_stop", note: "1 wrong answer(s) were typed into the check before the person came" })]));
  assert.equal(tampered?.passed, false);
  assert.match(tampered?.actual ?? "", /type-the-characters check already showed the automation's hand: 1 wrong answer/u);
  const stuck = personHandOffInvariant(read([handOff({ did: "could-not-clear", cleared: false, answer: "person_stop", note: "the check still showed 8000 ms after the person was done" })]));
  assert.match(stuck?.actual ?? "", /could not play the person at ask-1 \(could-not-clear\)/u);
  const unanswered = personHandOffInvariant(read([handOff({ answer: null, note: "the answer did not reach Core: expired" })]));
  assert.equal(unanswered?.passed, false);
});

test("a person who declines as the row says is correct: the declared failure then judges the run", () => {
  const declines: ExpectedPersonHandOff = { person: "declines", required: true, because: "The row measures FluxIQ stopping when the person says stop." };
  const invariant = personHandOffInvariant(read([handOff({ did: "declined", cleared: false, answer: "person_stop", note: "the row declares that the person declines" })], declines));
  assert.equal(invariant?.passed, true);
});

test("no record, or none needed, adds no invariant; an unreadable record fails", () => {
  assert.equal(personHandOffInvariant({ status: "absent" }), undefined);
  assert.equal(personHandOffInvariant(read([], null)), undefined);
  assert.equal(personHandOffInvariant(read([], { ...REQUIRED, required: false })), undefined);
  assert.equal(personHandOffInvariant({ status: "unreadable", reason: "the record is not JSON (SyntaxError)" })?.passed, false);
  assert.deepEqual(evaluate({ status: "absent" }).invariants.map(({ id }) => id), ["runner-verdict"]);
});

/** A bundle directory holding only the hand-off record, as `run-scenario.ts` writes it. */
function bundleWith(t: TestContext, contents: string | undefined): string {
  const directory = mkdtempSync(path.join(tmpdir(), "fluxiq-person-hand-offs-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  if (contents !== undefined) {
    mkdirSync(path.join(directory, "snapshots"));
    writeFileSync(path.join(directory, "snapshots", "person-hand-offs.json"), contents);
  }
  return directory;
}

test("the record is read from the bundle: absent, unreadable, or read with its declaration", (t) => {
  assert.deepEqual(personHandOffEvidence(bundleWith(t, undefined)), { status: "absent" });
  assert.equal(personHandOffEvidence(bundleWith(t, "{not json")).status, "unreadable");
  assert.equal(personHandOffEvidence(bundleWith(t, JSON.stringify({ scenarioId: "x", handOffs: [{ askId: 1 }], playable: true }))).status, "unreadable");
  const snapshot: PersonHandOffSnapshot = { scenarioId: "everything-store", expected: REQUIRED, playable: true, handOffs: [handOff()], pollFailures: 0, lastPollFailure: null };
  const evidence = personHandOffEvidence(bundleWith(t, JSON.stringify(snapshot)));
  assert.deepEqual(evidence, { status: "read", snapshot });
});
