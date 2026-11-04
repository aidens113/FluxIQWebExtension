import { assertRunAnswerScore, type AnswerOracleOutcome, type AnswerVerdict, type AnswerWrongReason, type AttemptEnding, type AttemptStandIn, type FlowScore, type RunAnswerScore } from "@fluxiq-web-extension/test-contracts";
import type { SiteChangeJudgement } from "../site-change/index.js";
import type { AttemptEndingFact } from "./ports.js";
import type { ShownAnswerJudgement } from "./judge-shown.js";

/**
 * The verdict from its parts, in one place.
 *
 * **The hard rule (user, 2026-11-03):** a task that ends without its result fails,
 * unless its budget is gone or a person stopped it. So a right answer is `right`
 * however the attempt ended, a budget or a person excuses anything short of right,
 * and every other ending that holds nothing is `wrong`: a stall, a refused call and a
 * chat that fell silent have no way to be anything else.
 */
export function scoreAnswer(input: {
  ending: AttemptEndingFact;
  /** Whether the attempt holds anything to judge: rows it stored, or an act it landed. */
  hasResult: boolean;
  records: AnswerOracleOutcome;
  finalState: AnswerOracleOutcome;
  change: SiteChangeJudgement | null;
  shown: ShownAnswerJudgement;
  storedRows: number | null;
  flow: FlowScore;
  standIns: readonly AttemptStandIn[];
}): RunAnswerScore {
  const { records, finalState, change, shown } = input;
  const reasons: AnswerWrongReason[] = [];
  if (!input.hasResult) reasons.push("no_result");
  else {
    if (records === "failed") reasons.push("records");
    if (finalState === "failed") reasons.push("final_state");
    if (change && change.repeatedActs.length > 0) reasons.push("repeated_act");
    if (change && !change.held && (change.missingActs.length > 0 || change.unaskedChanges.length > 0)) reasons.push("change");
    if (shown.secretShown) reasons.push("secret_shown");
    else if (shown.shown === "failed") reasons.push("not_shown");
  }
  // A repeated act is wrong whether or not anything else was: an order placed twice has happened, with or without a result to show for it.
  if (!input.hasResult && change && change.repeatedActs.length > 0) reasons.push("repeated_act");
  const excused: AnswerVerdict | null = input.ending === "budget_out" ? "budget_out" : input.ending === "stopped_by_person" ? "stopped_by_person" : null;
  const verdict: AnswerVerdict = reasons.length === 0 ? "right" : excused ?? "wrong";
  const ending: AttemptEnding = input.ending === "budget_out" || input.ending === "stopped_by_person" ? input.ending : input.hasResult ? "result" : "no_result";
  const score: RunAnswerScore = {
    verdict,
    ending,
    wrongBecause: verdict === "wrong" ? reasons : [],
    records,
    finalState,
    change: change === null ? "not_declared" : change.held ? "held" : "failed",
    shown: shown.shown,
    repeatedActs: change ? change.repeatedActs.map((act) => ({ ...act })) : [],
    missingActs: change ? [...change.missingActs] : [],
    unaskedChanges: change ? [...change.unaskedChanges] : [],
    storedRows: input.storedRows,
    shownRows: shown.shownRows,
    flow: input.flow,
    standIns: [...input.standIns],
  };
  assertRunAnswerScore(score);
  return score;
}
