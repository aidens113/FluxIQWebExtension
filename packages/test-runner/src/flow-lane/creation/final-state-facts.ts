// Which of a scenario's final-state facts did not hold after a created Flow ran,
// each with what it expected and what the page showed.
//
// The fixture oracle used to answer a bare yes or no, and a failed playback was
// reported as "the playback goal did not hold" with no fact named: the report
// read "step unknown" although the goal is a short list of concrete facts
// (run-muqiho5c-e830ce01, crossborder-marketplace HUB_IN_CART, a cart left with
// no line). Every fact is judged here, not only the first that fails, so the
// failure names all of them.

import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { assertExpectedFacts, type ScenarioFactProbe } from "../../scenario-assertions.js";

/** One declared fact that did not hold: the page's value beside the declared one. */
export type UnheldFact = Readonly<{ factId: string; subject: string; predicate: string; expected: unknown; observed: unknown }>;

/**
 * The fixture oracle's verdict on a created Flow's final state. `unheldFacts`
 * is empty when it held; `unjudged` says why the facts could not be read when
 * the page could not even be probed, so an empty list never stands for that.
 */
export type FinalStateVerdict = Readonly<{ held: boolean; unheldFacts: readonly UnheldFact[]; unjudged?: string }>;

/**
 * Every fact in `facts` that does not hold on the page `probe` reads, in
 * declaration order. A fact the fixture declares wrongly (a value of the wrong
 * type, an unknown predicate) still throws: that is a fixture defect, not a
 * fact the Flow missed.
 */
export async function judgeExpectedFacts(facts: readonly ExpectedFact[], probe: ScenarioFactProbe): Promise<UnheldFact[]> {
  const unheld: UnheldFact[] = [];
  for (const fact of facts) {
    try {
      await assertExpectedFacts([fact], probe);
    } catch (error) {
      if (!(error instanceof RunnerFailure) || error.details?.factId !== fact.id) throw error;
      unheld.push({ factId: fact.id, subject: fact.subject, predicate: fact.predicate, expected: fact.value, observed: error.details.actual ?? null });
    }
  }
  return unheld;
}
