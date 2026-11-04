// The shapes the state-rule harness reads and reports. Every member of a report is an
// identifier, a code, a count or a field path: no page text, row value, URL or token.

import type { ClientGatewayTraceManifest, ClientGatewayTraceStateRecordedCall, ClientGatewayTraceStateSkippedActs, ClientGatewayTraceStateVerdictValue } from "fluxiq/client-gateway";

/** What the Lab saved about one run: its verdicts, its window, and where its store should be. */
export type LabRunRecord = Readonly<{
  runId: string;
  /** The run's folder: its `steps/` and `evaluation.json`. */
  directory: string;
  task: string;
  scenario: string;
  instance: string;
  repositoryRoot: string;
  startedAt: string;
  finishedAt: string | null;
  verdict: string;
  /** The task's oracle on the Flow's rows; null when no Flow reached it. */
  oracleVerdict: string | null;
  reportedVerdict: string | null;
  flowCreated: boolean;
  facilityFailure: boolean;
  provider: string | null;
  model: string | null;
}>;

/** One trace read from a store: its manifest and its commands with their answers. */
export type StoreTrace = Readonly<{
  manifest: ClientGatewayTraceManifest;
  calls: readonly ClientGatewayTraceStateRecordedCall[];
  firstChild: number | null;
  /** Why Core's offline runner would refuse this trace; null when it would admit it. */
  refusal: string | null;
}>;

/** The two exploration readings: before the build's first trial (the closest thing to one exploration), or all of the model's calls. */
export type ExplorationScope = "first" | "whole";

/** Which saved Flow run a build is judged by. */
export type FlowSource = "last_live_test" | "execution" | "dry_run" | "none";

/**
 * One way of reading the rule. `gap`: the study's rule, what followed a skipped act is
 * refused. `layers`: the same, with an act that closed a layer not counted as an act done.
 * `tolerate`: a read or move after skipped acts is answered, with the count on the answer.
 */
export type StateRuleSkipping = ClientGatewayTraceStateSkippedActs | "layers";

export type StateRuleConfig = Readonly<{ scope: ExplorationScope; skipping: StateRuleSkipping }>;

/** How a Flow's walk over a recording came out, against that Flow's own live answers. */
export type WalkTally = {
  commands: number;
  answered: number;
  /** Commands before the run first left the recording (an unrecorded act or move), and how many of those were answered. */
  commandsOnRecording: number;
  answeredOnRecording: number;
  /** Commands whose canonical input the recording holds anywhere, by kind, whatever the state: "exactly the same input". */
  readsSameInput: number;
  readsOtherInput: number;
  movesSameInput: number;
  movesOtherInput: number;
  actsSameInput: number;
  actsOtherInput: number;
  /** Every answered command's status against the live one, the control's measure of status. */
  statusSameAll: number;
  statusDifferAll: number;
  /** Commands the live run sent only because the live answer failed where the recorded one did not. */
  notSent: number;
  /** By gap code. */
  gaps: Record<string, number>;
  readsAnswered: number;
  /** Page URL on reads answered from the same state, compared with the live answer, the opening reads before the Flow's first move aside. */
  urlSame: number;
  urlDiffer: number;
  /** The same for the opening reads, where the live run stood wherever the last one left it. */
  openingUrlSame: number;
  openingUrlDiffer: number;
  /** Snapshots alone, the control's measure. */
  snapshotUrlSame: number;
  snapshotUrlDiffer: number;
  /** Interactive selector sets of answered snapshots: overlap of at least 0.5, and under it. */
  selectorsClose: number;
  selectorsFar: number;
  /** Of the close ones, those at the harder line. */
  selectorsVeryClose: number;
  rowsSame: number;
  rowsDiffer: number;
  statusSameMoves: number;
  statusDifferMoves: number;
  statusSameActs: number;
  statusDifferActs: number;
  /** Act and move disagreements, by `recorded|live|live failure code|layer`. */
  disagreements: Record<string, number>;
  /** Of the disagreements, the ones marked may-be-gone-next-time. */
  markedActDisagreements: number;
  /**
   * What position-blind reading would have said: for each read while the run was still on
   * the recording, the same input recorded after the same acts on another node, against
   * the live URL. The study's "same act version, other position".
   */
  blindPositionUrlSame: number;
  blindPositionUrlDiffer: number;
  /** Refused reads, by gap code: what the refused recorded answer would have said of the page URL. */
  refusedUrlSame: Record<string, number>;
  refusedUrlDiffer: Record<string, number>;
  /** Field paths where a gap's command differed from the nearest recorded call. */
  gapFields: Record<string, number>;
  /** What first took the run off the recording, by `code|action type`. */
  firstLeave: Record<string, number>;
  /** Each act gap's nearest recorded act: `other_selector`, or the same selector with descriptors that `agree` where both hold them or `conflict`. */
  actGapElements: Record<string, number>;
};

/** The pure verdict on one Flow, and why. */
export type WalkVerdict = Readonly<{
  verdict: ClientGatewayTraceStateVerdictValue;
  reasons: readonly string[];
  firstGap: Readonly<{ ordinal: number; code: string; actionType: string }> | null;
  recordedActs: number;
  usedActs: number;
  receiptedActs: number;
  skippedActs: number;
  /** Of the skipped, those marked as closing a layer. */
  skippedLayerActs: number;
}>;

/** One build measured under one config. */
export type BuildMeasure = Readonly<{
  flow: FlowSource;
  recordedCalls: number;
  tally: WalkTally;
  verdict: WalkVerdict;
}>;

/** What a Flow's two live runs say of each other, by position: the target to be close to. */
export type ControlTally = {
  positions: number;
  keySame: number;
  statusSame: number;
  statusDiffer: number;
  snapshotUrlSame: number;
  snapshotUrlDiffer: number;
  selectorsClose: number;
  selectorsFar: number;
  selectorsVeryClose: number;
  selectorsEqual: number;
  rowsSame: number;
  rowsDiffer: number;
  /** Status by kind of call, so an act's stability can be read apart from the reads around it. */
  statusSameActs: number;
  statusDifferActs: number;
  statusSameMoves: number;
  statusDifferMoves: number;
  /** Status of the acts the run's own earlier read marked as being in a layer. */
  statusSameLayerActs: number;
  statusDifferLayerActs: number;
};

/** A deliberately broken Flow, made from the exploration itself. It must never pass. */
export type MutationName = "drop_last_act" | "repeat_act" | "other_row" | "changed_read" | "swap_acts" | "drop_last_move";

export type MutationResult = Readonly<{ mutation: MutationName; verdict: ClientGatewayTraceStateVerdictValue; reasons: readonly string[] }>;

/** The exploration walked as its own Flow: every command must be answered, each with its own answer. */
export type SelfWalk = Readonly<{ tally: WalkTally; verdict: WalkVerdict; mutations: readonly MutationResult[] }>;

/**
 * One live Flow run walked over the build's previous live Flow run: a recording made in
 * the Flow's own wire form, as a later attempt's would be. `liveFrom` and `liveTo` are
 * what each trial's judge said, when the run was a trial.
 */
export type FlowPairMeasure = Readonly<{
  from: string;
  to: string;
  fromActivity: string;
  toActivity: string;
  liveFrom: string | null;
  liveTo: string | null;
  sameCommands: boolean;
  tally: WalkTally;
  verdict: WalkVerdict;
}>;

export type TrialMeasure = Readonly<{ traceId: string; liveVerdict: string | null; verdict: ClientGatewayTraceStateVerdictValue; reasons: readonly string[]; commands: number; answered: number }>;

export type BuildReport = Readonly<{
  runId: string;
  task: string;
  scenario: string;
  provider: string | null;
  model: string | null;
  authoringMode: string | null;
  labVerdict: string;
  oracleVerdict: string | null;
  reportedVerdict: string | null;
  flowCreated: boolean;
  facilityFailure: boolean;
  explorationTrace: string;
  explorationRefusal: string | null;
  flow: FlowSource;
  flowTrace: string | null;
  flowRefusal: string | null;
  /** Keyed by `<scope>/<skippedActs>`. */
  measures: Readonly<Record<string, BuildMeasure>>;
  control: ControlTally | null;
  self: SelfWalk | null;
  trials: readonly TrialMeasure[];
  pairs: readonly FlowPairMeasure[];
}>;
