/**
 * STAND-IN prices for a scripted model call, so a scripted attempt's calls, tokens and
 * dollars can be compared. **No model is called**, and no real money moves: these are
 * arithmetic, flagged `spend` on every row. Live steps and time on the same row are
 * measured.
 */
export const SCRIPTED_CALL = Object.freeze({ inputTokens: 2_400, outputTokens: 180, usd: 0.003 });

/** The judge's calls at the end of an attempt with no saved Flow to run, as Core's minimum today (a build's check asks twice). */
export const SCRIPTED_JUDGE_CALLS_WITHOUT_FLOW = 2;

/** One judge's call on a saved Flow's run. */
export const SCRIPTED_JUDGE_CALLS_WITH_FLOW = 1;

export type ScriptedSpend = Readonly<{ calls: number; inputTokens: number; outputTokens: number; usd: number }>;

/** What `calls` scripted calls would come to. */
export function scriptedSpend(calls: number): ScriptedSpend {
  return { calls, inputTokens: calls * SCRIPTED_CALL.inputTokens, outputTokens: calls * SCRIPTED_CALL.outputTokens, usd: calls * SCRIPTED_CALL.usd };
}
