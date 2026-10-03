// Both oracles a created Flow's run is held to: the records it stored, and the
// state the scenario declares the page must be left in.
//
// A dataset task was judged by its records alone, and a task's declared
// `finalState` was never read (lane t184). So a run that stored the right
// records by the wrong route passed: bigbox pickup-order that deleted the soap
// instead of saving it for later, or a kettle-to-cart run that deleted the
// phone case, left the same records as the honest run. A run now passes only
// when every oracle the task declares holds, and a failure names which did not.

import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { assertExpectedFacts, type ScenarioFactProbe } from "../../scenario-assertions.js";
import type { FlowExtractionJudgement } from "../expectations.js";
import type { FinalStateVerdict, UnheldFact } from "./final-state-facts.js";
import { assertCreatedFlowDataset, createdFlowDatasetHolds } from "./judgement.js";

/** One declared fact as the page read it, held or not: what the fact expected beside what the page showed. */
export type JudgedFact = UnheldFact & Readonly<{ held: boolean }>;

/** A final-state verdict that also carries every fact it read, held ones included. */
export type JudgedFinalState = FinalStateVerdict & Readonly<{ facts?: readonly JudgedFact[] }>;

/**
 * Each oracle's verdict, `not_declared` where the task holds the run to no such
 * thing. A failed final state carries the facts that did not hold
 * (`final-state-facts.ts`), and `finalStateUnjudged` when they could not be read.
 *
 * `facts` is every fact the final state was read against, held or not, with
 * the page's value beside the declared one. A pass used to keep only `held`,
 * so a debug of a passing run could not say what the page actually read
 * (run-murwd8le-79e735a8, Cause 13). Absent where no fact was read.
 */
export type CreatedFlowOracles = Readonly<{
  records: "held" | "failed" | "not_declared";
  finalState: "held" | "failed" | "not_declared";
  unheldFacts?: readonly UnheldFact[];
  finalStateUnjudged?: string;
  facts?: readonly JudgedFact[];
}>;

/** What stands in for a page's value where the scenario declares a secret: the rule `snapshots/extraction-mismatches.json` follows. */
const WITHHELD = "[withheld: the scenario declares a secret]";

/**
 * Every fact in `facts`, in declaration order, with the value the page showed
 * for it and whether it held. The value is what the fixture oracle compared:
 * the trimmed text for `text`, the whole text for `contains`, the flag, path
 * or count otherwise. A fact the fixture declares wrongly still throws, as in
 * `judgeExpectedFacts`: that is a fixture defect, not a fact the Flow missed.
 */
export async function judgeEveryFact(facts: readonly ExpectedFact[], probe: ScenarioFactProbe): Promise<JudgedFact[]> {
  const judged: JudgedFact[] = [];
  for (const fact of facts) {
    let read: unknown = null;
    const seen = <T>(value: T): T => { read = value; return value; };
    const recording: ScenarioFactProbe = {
      text: async subject => seen(await probe.text(subject)),
      visible: async subject => seen(await probe.visible(subject)),
      exists: async subject => seen(await probe.exists(subject)),
      enabled: async subject => seen(await probe.enabled(subject)),
      path: async () => seen(await probe.path()),
      iframeCount: async () => seen(await probe.iframeCount()),
      labelCount: async label => seen(await probe.labelCount(label)),
    };
    const base = { factId: fact.id, subject: fact.subject, predicate: fact.predicate, expected: fact.value };
    try {
      await assertExpectedFacts([fact], recording);
      judged.push({ ...base, observed: fact.predicate === "text" && typeof read === "string" ? read.trim() : read, held: true });
    } catch (error) {
      if (!(error instanceof RunnerFailure) || error.details?.factId !== fact.id) throw error;
      judged.push({ ...base, observed: error.details.actual ?? null, held: false });
    }
  }
  return judged;
}

/**
 * The oracles with every observed value withheld, held facts' as well as
 * unheld ones', for a scenario that declares a secret. The declared values
 * stay: they are the fixture's, not the page's.
 */
export function withholdObservedFactValues(oracles: CreatedFlowOracles): CreatedFlowOracles {
  return {
    ...oracles,
    ...(oracles.unheldFacts ? { unheldFacts: oracles.unheldFacts.map(fact => ({ ...fact, observed: WITHHELD })) } : {}),
    ...(oracles.facts ? { facts: oracles.facts.map(fact => ({ ...fact, observed: WITHHELD })) } : {}),
  };
}

/** The oracles a failure's details carry: as they always were, without the held facts' page values. */
function failureOracles(oracles: CreatedFlowOracles): CreatedFlowOracles {
  const { facts: _facts, ...rest } = oracles;
  return rest;
}

/**
 * The verdict of each oracle. The final state is consulted for a dataset task
 * only when its workflow declares one; a goal task is judged by it always, as
 * it always was.
 */
export async function judgeCreatedFlowOracles(input: {
  extraction: FlowExtractionJudgement | null;
  declaresFinalState: boolean;
  judgeFinalState: () => Promise<JudgedFinalState>;
}): Promise<CreatedFlowOracles> {
  const records = input.extraction ? (createdFlowDatasetHolds(input.extraction) ? "held" : "failed") : "not_declared";
  if (input.extraction && !input.declaresFinalState) return { records, finalState: "not_declared" };
  const verdict = await input.judgeFinalState();
  const facts = verdict.facts && verdict.facts.length > 0 ? { facts: verdict.facts } : {};
  if (verdict.held) return { records, finalState: "held", ...facts };
  return { records, finalState: "failed", ...(verdict.unheldFacts.length > 0 ? { unheldFacts: verdict.unheldFacts } : {}), ...(verdict.unjudged === undefined ? {} : { finalStateUnjudged: verdict.unjudged }), ...facts };
}

/** The facts a failed final state names, for the failure's one line: `cart-line, coupons-held`, or why none could be named. */
function unheldFactsClause(oracles: CreatedFlowOracles): string {
  const ids = (oracles.unheldFacts ?? []).map(fact => fact.factId);
  if (ids.length > 0) return ` (fact${ids.length === 1 ? "" : "s"} not held: ${ids.join(", ")})`;
  return oracles.finalStateUnjudged === undefined ? "" : ` (its facts could not be read: ${oracles.finalStateUnjudged})`;
}

/** Whether every oracle the task declares held. */
export function createdFlowOraclesHold(oracles: CreatedFlowOracles): boolean {
  return oracles.records !== "failed" && oracles.finalState !== "failed";
}

/**
 * Fails a run whose oracles did not all hold, naming which. The records'
 * own failure keeps its account of what was stored and expected; a final state
 * that also failed is added to it rather than hidden behind it.
 */
export function assertCreatedFlowOracles(extraction: FlowExtractionJudgement | null, oracles: CreatedFlowOracles): void {
  const finalStateFailed = oracles.finalState === "failed";
  if (extraction && oracles.records === "failed") {
    try {
      assertCreatedFlowDataset(extraction);
    } catch (error) {
      if (!finalStateFailed || !(error instanceof RunnerFailure)) throw error;
      throw new RunnerFailure(error.category, `${error.message}; and the scenario's final state did not hold afterwards${unheldFactsClause(oracles)}`, { details: { ...(error.details ?? {}), oracles: failureOracles(oracles) } });
    }
  }
  if (!finalStateFailed) return;
  throw new RunnerFailure("runtime.behavior", extraction
    ? `The created Flow stored the expected records, but the scenario's final state did not hold afterwards${unheldFactsClause(oracles)}`
    : `The created Flow ran, but the scenario's playback goal did not hold afterwards${unheldFactsClause(oracles)}`, { details: { oracles: failureOracles(oracles) } });
}
