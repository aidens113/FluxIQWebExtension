/** A half-open span of wall time, `[start, end)`, in epoch milliseconds. */
export type Interval = { start: number; end: number };

/**
 * The measured shares of a build's wall time plus the remainder. Where
 * intervals overlap, the category earlier in the precedence reset > offline >
 * trial > model > exploration owns the time: a reset step Core runs inside a
 * trial is reset time; the offline check a test call runs against a recording
 * first is offline time (it touches no site); a judge call inside a trial is
 * trial time; a decide inside a reset brief is reset time.
 */
export type BuildCategory = "trial" | "offline" | "reset" | "model" | "exploration" | "other";

/**
 * What one step is to the measurement. Besides a category: `playback` is the
 * Lab's replay of the applied Flow (excluded from build time), `playback-judge`
 * a judge with no build part that belongs to an adjacent playback (judged by
 * context, else model time), and `container` a step whose window only wraps
 * other steps (a non-reset `project.dispatch`), which counts nothing itself.
 */
export type StepClass = BuildCategory | "playback" | "playback-judge" | "container";

/** The timing fields of one `steps/NNNN-<kind>/meta.json`; nothing a step saw or said. */
export type StepTiming = {
  /** The step folder's name, `NNNN-<kind>[-<toolId>]`. */
  folder: string;
  /** The `NNNN` of the folder; the order Core wrote the steps in. */
  index: number;
  kind: string;
  toolId: string | null;
  callId: string | null;
  /** An `offline_trial` step's outcome (`kept_no`, `kept_failed`, `passed`, `gap`, `inconclusive`, `not_tried`, `refused:<code>`); null for every other step. */
  outcome: string | null;
  phase: string | null;
  part: string | null;
  provider: string | null;
  round: number | null;
  status: string | null;
  start: number;
  end: number;
};

/** One rule of the classification table, first match wins. */
export type CategoryRule = {
  id: string;
  category: StepClass;
  /** What the rule matches, in words, for the report's table. */
  describes: string;
  matches: (step: StepTiming) => boolean;
};

/** One run folder under the Lab's runs root that holds steps. */
export type RunFolder = {
  directory: string;
  runId: string;
  /** `entry.json`'s start, else the date folder's name. */
  startedAt: string;
  verdict: string;
  task: string;
  lane: string;
};

/** One run's measurement as the report prints it. */
export type RunBuildTimeRow = RunFolder & { measured: RunBuildTime; incomplete: string[] };

/** Totals over many runs: pooled milliseconds and pooled shares (time-weighted). */
export type BuildTimeTotals = {
  runs: number;
  wallMs: number;
  exclusive: Record<BuildCategory, number>;
  /** Pooled share of wall time per category, 0..1; sums to 1. */
  share: Record<BuildCategory, number>;
  /** Unweighted mean of the per-run shares, 0..1. */
  meanShare: Record<BuildCategory, number>;
  idleMs: number;
  modelInTrialMs: number;
  resetInTrialMs: number;
  /** Every test window, offline-kept ones included. */
  trialCount: number;
  /** Test windows without a kept offline answer: the ones that ran on the site. */
  liveTrialCount: number;
  /** Offline steps that ran (not `not_tried`, not `refused:*`). */
  offlineTrialCount: number;
  playbackMs: number;
  incompleteSteps: number;
  unknown: Record<string, number>;
  ruleCounts: Record<string, number>;
};

/** How one run's build wall time divides. Every figure is milliseconds. */
export type RunBuildTime = {
  /** First build step's start to last build step's end, less playback windows. */
  wallMs: number;
  buildStart: number | null;
  buildEnd: number | null;
  /** Wall time of all the Lab's playback windows; the part inside the build span is subtracted from `wallMs`. */
  playbackMs: number;
  /** Each category's share under the precedence; these sum to `wallMs`. */
  exclusive: Record<BuildCategory, number>;
  /** Each category's own interval union, overlaps not removed (`other` is the known bookkeeping steps only). */
  union: Record<BuildCategory, number>;
  /** Build time covered by no step at all; part of `exclusive.other`. */
  idleMs: number;
  /** Model-call time inside trial windows (counted as trial in `exclusive`). */
  modelInTrialMs: number;
  /** Reset time inside trial windows: Core's reset steps there (t737), counted as reset in `exclusive`, not trial. */
  resetInTrialMs: number;
  /** Every test window (`core.test_*` tool call or dry-run round), offline-kept ones included. */
  trialCount: number;
  /** Test windows without a kept offline answer (`kept_no`, `kept_failed`): the ones that ran on the site. */
  liveTrialCount: number;
  /** Offline steps that ran against a recording (any outcome but `not_tried` and `refused:*`). */
  offlineTrialCount: number;
  /** The longest trial tool window (or dry-run round), its resets included. */
  longestTrialMs: number;
  /** Steps measured, playback steps included. */
  stepCount: number;
  /** Steps that matched no rule, by `kind:toolId`; their time is in `other`. */
  unknown: Record<string, number>;
  /** How many steps each rule matched, by rule id. */
  ruleCounts: Record<string, number>;
};
