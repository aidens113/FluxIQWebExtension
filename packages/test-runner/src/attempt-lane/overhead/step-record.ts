/** One step folder of a run's `steps/`, reduced to what the overhead reader needs. */
export type StepRecord = Readonly<{
  step: number;
  /** `meta.json` `kind`: chat, decide, tool, answer, loop, judge, flow or note. */
  kind: string;
  toolId: string | null;
  resultCode: string | null;
  summary: string;
  /** A tool step's `call.json` `callId` and `input`, when the folder holds one. */
  callId: string | null;
  callInput: unknown;
  /** The page address a by-hand call left, from its `result.json`; `null` for a replayed node, which carries no page. */
  locationAfter: string | null;
  /** A `core.run_flow` decision's `from` step, read from its `decision.json`. */
  runFrom: number | null;
}>;
