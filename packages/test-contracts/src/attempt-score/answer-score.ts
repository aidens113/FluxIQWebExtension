// The two questions the Lab scores apart (Answer First, user 2026-11-03): did the
// person get the right answer, and did the Flow become deterministic. The first is
// judged on the attempt itself, before any fixture reset, and is `answerVerdict`.
// The second is `oracleVerdict` and the replay, which mean Flow playback only.
//
// **Old pass rates are not comparable to `answerVerdict` and are never blended with
// it.** A run written before it exists states none, and nothing infers one.

/**
 * - `right`: the person got the right answer, as stored and as shown.
 * - `wrong`: it was judged and did not hold, or the task ended with no result. The
 *   hard rule (user, 2026-11-03): a task that ends without its result fails, unless
 *   its budget is gone or a person stopped it.
 * - `budget_out`, `stopped_by_person`: the two excused endings, when what it had by
 *   then did not hold. Neither is a pass, and neither counts as wrong.
 */
export const answerVerdicts = ["right", "wrong", "budget_out", "stopped_by_person"] as const;
export type AnswerVerdict = (typeof answerVerdicts)[number];

/** How the attempt ended, before anything is judged. `no_result` is the ending the hard rule fails. */
export const attemptEndings = ["result", "no_result", "budget_out", "stopped_by_person"] as const;
export type AttemptEnding = (typeof attemptEndings)[number];

/** Why an answer is wrong, each once. */
export const answerWrongReasons = ["no_result", "records", "final_state", "change", "repeated_act", "not_shown", "secret_shown"] as const;
export type AnswerWrongReason = (typeof answerWrongReasons)[number];

/**
 * One oracle on the attempt: `not_declared` where the task holds it to no such thing.
 * `unjudged` is only for what was shown, when it could be read but not compared.
 */
export const answerOracleOutcomes = ["held", "failed", "not_declared"] as const;
export type AnswerOracleOutcome = (typeof answerOracleOutcomes)[number];

export const answerShownOutcomes = ["held", "failed", "unjudged"] as const;
export type AnswerShownOutcome = (typeof answerShownOutcomes)[number];

/**
 * The Flow's score, apart from the answer's.
 *
 * - `unproven`: no judged playback, a draft or no Flow at all.
 * - `playback_held`, `playback_failed`: `oracleVerdict` on the Flow's own playback.
 * - `replay_held`: a zero-call replay of it held (`lab replay`), so it is deterministic.
 */
export const flowScores = ["unproven", "playback_held", "playback_failed", "replay_held"] as const;
export type FlowScore = (typeof flowScores)[number];

/**
 * Which inputs of a score were scripted rather than read from Core, so a stand-in can never pass as the product.
 *
 * `model` is the scripted Anthropic server every model call of a run went to, and `spend` the
 * calls, tokens and dollars that follow from its made-up usage. With `model` on a row the rest of
 * the road is the product's and the choices are a script's, so it proves the road and nothing of
 * what a model would do.
 */
export const attemptStandIns = ["attempt_record", "stored_rows", "chat_turn", "exploration", "workspace", "spend", "model"] as const;
export type AttemptStandIn = (typeof attemptStandIns)[number];

/** Whether a score or a row with these stand-ins counts as a live result. Any stand-in at all means it does not. */
export function attemptCountsAsLive(standIns: readonly AttemptStandIn[]): boolean {
  return standIns.length === 0;
}

/** An act that landed more than asked, by its name in the Lab's table. Words the Lab wrote, never page text. */
export type RepeatedActReport = { name: string; asked: number; landed: number };

/**
 * Counts and closed names only: what was stored and shown is judged, never kept.
 *
 * `records` compares the attempt's stored rows, `finalState` the site's declared
 * facts, `change` what the site recorded since the attempt's baseline, and `shown`
 * what reached the person. `change` is `not_declared` for a task the Lab's table does
 * not hold.
 */
export type RunAnswerScore = {
  verdict: AnswerVerdict;
  ending: AttemptEnding;
  wrongBecause: AnswerWrongReason[];
  records: AnswerOracleOutcome;
  finalState: AnswerOracleOutcome;
  change: AnswerOracleOutcome;
  shown: AnswerShownOutcome;
  repeatedActs: RepeatedActReport[];
  /** Asked acts that did not land as asked, by name. */
  missingActs: string[];
  /** Lasting names the site moved that the task never asked to move. */
  unaskedChanges: string[];
  /** Rows the attempt stored and rows the person was shown; `null` for a task with no records to compare. */
  storedRows: number | null;
  shownRows: number | null;
  flow: FlowScore;
  /** Empty when every input was read from Core and the real chat. */
  standIns: AttemptStandIn[];
};

/** The Flow's score from what the evaluation says of its playback. A zero-call replay is a separate invocation, which alone can say `replay_held`. */
export function flowScoreOf(evaluation: { flowCreated: boolean | null; oracleVerdict: "passed" | "failed" | null }): FlowScore {
  if (evaluation.flowCreated !== true || evaluation.oracleVerdict === null) return "unproven";
  return evaluation.oracleVerdict === "passed" ? "playback_held" : "playback_failed";
}
