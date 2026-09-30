import type { InvariantResult } from "@fluxiq-web-extension/test-contracts";
import type { PersonHandOff } from "../person-simulation/index.js";
import type { PersonHandOffEvidence } from "./person-hand-off-evidence.js";

/** The invariant's id in `RunEvaluation.invariants`. */
export const PERSON_HAND_OFF_INVARIANT = "person-hand-off";

/**
 * Whether FluxIQ handed checks to a person when, and only when, it should
 * have.
 *
 * A check only a person may pass is FluxIQ's to hand off, never to press,
 * type into or reload, so a hand-off there is correct behaviour and passes
 * this invariant whether or not the row declared one: a run that asked the
 * person and then read the page is the product working. What fails it:
 *
 * - a hand-off where no check the Lab knows was showing: FluxIQ asked a person
 *   for nothing, and the run stopped for it;
 * - a check that already showed the automation's hand on it -- a guess typed,
 *   a new image asked for -- which is the thing the hand-off exists to prevent;
 * - a row that `required` a hand-off, and got none: every honest path meets
 *   the check, so FluxIQ met it without asking, or never reached it;
 * - a hand-off the Lab could not play (no person module, a step the page
 *   refused, a check that stayed, an answer that did not reach Core), because
 *   the run's ending then says nothing about FluxIQ, and saying so is the
 *   only honest verdict.
 *
 * A run with no hand-off and none required gets no invariant: a vacuous pass
 * would read as a measurement.
 */
export function personHandOffInvariant(evidence: PersonHandOffEvidence): InvariantResult | undefined {
  if (evidence.status === "absent") return undefined;
  if (evidence.status === "unreadable") return invariant(false, "a readable record of the Lab's hand-offs", evidence.reason);
  const { expected, handOffs, pollFailures, lastPollFailure } = evidence.snapshot;
  if (handOffs.length === 0 && !expected?.required) return undefined;
  const expectedText = expected
    ? `${expected.required ? "a hand-off" : "any hand-off"} at the check the row names, which the person ${expected.person === "completes" ? "clears" : "declines"}: ${expected.because}`
    : "a hand-off only at a check only a person may pass";
  const problems: string[] = [];
  const noCheck = handOffs.filter(({ did }) => did === "no-check-visible");
  if (noCheck.length) problems.push(`${noCheck.length} hand-off(s) where no check the Lab knows was showing (${stages(noCheck)})`);
  for (const handOff of handOffs.filter(({ did }) => did === "declined-tampered")) problems.push(`the ${handOff.check} check already showed the automation's hand: ${handOff.note}`);
  const unplayed = handOffs.filter(({ did, answer }) => did === "failed" || did === "could-not-clear" || answer === null);
  for (const handOff of unplayed) problems.push(`the Lab could not play the person at ${handOff.askId} (${handOff.did}): ${handOff.note ?? "no answer reached Core"}`);
  const atChecks = handOffs.filter(({ check }) => check !== null);
  if (expected?.required && atChecks.length === 0) {
    const unread = pollFailures > 0 ? `; the Lab could not read Core's threads ${pollFailures} time(s), last: ${lastPollFailure}` : "";
    problems.push(`no hand-off: FluxIQ met the check without asking a person, or never reached it${unread}`);
  }
  if (problems.length) return invariant(false, expectedText, problems.join("; "));
  const undeclared = expected === null ? "; the row declares none, and a hand-off at a real check is still correct" : "";
  return invariant(true, expectedText, `${atChecks.length} hand-off(s): ${atChecks.map(describe).join(", ")}${undeclared}`);
}

function describe(handOff: PersonHandOff): string {
  return `${handOff.check} at ${handOff.stage}, ${handOff.did} after ${handOff.secondsWaited} s`;
}

function stages(handOffs: readonly PersonHandOff[]): string {
  return handOffs.map(({ stage }) => stage).join(", ");
}

function invariant(passed: boolean, expected: string, actual: string): InvariantResult {
  return { id: PERSON_HAND_OFF_INVARIANT, passed, expected, actual, evidenceSequences: [] };
}
