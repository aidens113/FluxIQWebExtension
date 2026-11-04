// One saved build measured: its exploration read as a recording under each config, its
// Flow walked over it, every earlier live trial judged the same way, the Flow's two live
// runs compared with each other, and the exploration walked as its own Flow, whole and
// deliberately broken.
//
// **Which Flow.** A project build's last live test, else its first complete live
// execution, else (a legacy build with neither) its last dry run, whose commands sit
// inside the exploration trace.

import { clientGatewayTraceStateIsBookkeepingCall, clientGatewayTraceStateRecording, type ClientGatewayTraceStateDomain, type ClientGatewayTraceStateRecordedCall, type ClientGatewayTraceStateRecording } from "fluxiq/client-gateway";
import { jsonRecord } from "../json-record.js";
import { flowControl } from "./control.js";
import { walkFlow } from "./flow-walk.js";
import { traceStateMutations } from "./mutations.js";
import { traceStateReceipts } from "./receipts.js";
import type { BuildMeasure, BuildReport, ExplorationScope, FlowPairMeasure, FlowSource, LabRunRecord, SelfWalk, StateRuleConfig, StoreTrace, TrialMeasure } from "./types.js";

export const STATE_RULE_CONFIGS: readonly StateRuleConfig[] = Object.freeze([
  Object.freeze({ scope: "first", skipping: "gap" }),
  Object.freeze({ scope: "first", skipping: "layers" }),
  Object.freeze({ scope: "first", skipping: "tolerate" }),
  Object.freeze({ scope: "whole", skipping: "gap" }),
  Object.freeze({ scope: "whole", skipping: "layers" }),
  Object.freeze({ scope: "whole", skipping: "tolerate" }),
]);

export function configKey(config: StateRuleConfig): string {
  return `${config.scope}/${config.skipping}`;
}

const DRY_RUN = /^dryrun\.(\d+)/u;
const DRY_RUN_RESET = /\.reset$/u;

/** A trace's calls for the rule: Core's bookkeeping gone, and for `first` everything from the build's first trial on. */
export function explorationCalls(trace: StoreTrace, scope: ExplorationScope): readonly ClientGatewayTraceStateRecordedCall[] {
  const inScope = scope === "first" && trace.firstChild !== null ? trace.calls.filter((call) => call.sequence < trace.firstChild!) : trace.calls;
  return inScope.filter((call) => !clientGatewayTraceStateIsBookkeepingCall(call.callId));
}

export function flowCalls(calls: readonly ClientGatewayTraceStateRecordedCall[]): readonly ClientGatewayTraceStateRecordedCall[] {
  return calls.filter((call) => !clientGatewayTraceStateIsBookkeepingCall(call.callId));
}

/** The commands of a legacy build's last dry run, from inside its exploration trace. */
export function lastDryRun(exploration: StoreTrace): readonly ClientGatewayTraceStateRecordedCall[] {
  let last = -1;
  for (const call of exploration.calls) {
    const attempt = DRY_RUN.exec(call.callId ?? "");
    if (attempt !== null) last = Math.max(last, Number(attempt[1]));
  }
  if (last < 0) return [];
  return exploration.calls.filter((call) => {
    const attempt = DRY_RUN.exec(call.callId ?? "");
    return attempt !== null && Number(attempt[1]) === last && !DRY_RUN_RESET.test(call.callId ?? "");
  });
}

export function buildRecording(calls: readonly ClientGatewayTraceStateRecordedCall[], domain: ClientGatewayTraceStateDomain, layerActsAreReceipted = false): ClientGatewayTraceStateRecording {
  // Receipts are by a call's place among these calls, as the recording reads them.
  return clientGatewayTraceStateRecording({ calls, domain, receipts: traceStateReceipts(calls, domain), layerActsAreReceipted });
}

export function measureBuild(input: {
  run: LabRunRecord;
  exploration: StoreTrace;
  traces: readonly StoreTrace[];
  domain: ClientGatewayTraceStateDomain;
  trialVerdicts: ReadonlyMap<string, string>;
}): BuildReport {
  const { run, exploration, traces, domain, trialVerdicts } = input;
  const tests = traces.filter((trace) => trace.manifest.activity === "test" && trace.manifest.origin.kind === "live");
  const executions = traces.filter((trace) => trace.manifest.activity === "execution" && trace.manifest.origin.kind === "live" && trace.manifest.completeness.status === "complete");
  const chosen = chooseFlow(exploration, tests, executions);
  const measures: Record<string, BuildMeasure> = {};
  if (chosen.flow !== "none") {
    for (const config of STATE_RULE_CONFIGS) {
      const recording = buildRecording(explorationCalls(exploration, config.scope), domain, config.skipping === "layers");
      const flow = chosen.flow === "dry_run" ? chosen.calls : flowCalls(chosen.calls);
      const { tally, verdict } = walkFlow({ flow, recording, domain, options: { skippedActs: config.skipping === "tolerate" ? "tolerate" : "gap" } });
      measures[configKey(config)] = Object.freeze({ flow: chosen.flow, recordedCalls: recording.entries.length, tally, verdict });
    }
  }
  const lastTest = tests.at(-1);
  const firstExecution = executions[0];
  const context = jsonRecord(jsonRecord(exploration.manifest.context)?.value);
  return Object.freeze({
    runId: run.runId, task: run.task, scenario: run.scenario, provider: run.provider, model: run.model,
    authoringMode: typeof context?.authoringMode === "string" ? context.authoringMode : null,
    labVerdict: run.verdict, oracleVerdict: run.oracleVerdict, reportedVerdict: run.reportedVerdict,
    flowCreated: run.flowCreated, facilityFailure: run.facilityFailure,
    explorationTrace: shortId(exploration.manifest.traceId),
    explorationRefusal: exploration.refusal,
    flow: chosen.flow,
    flowTrace: chosen.trace === null ? null : shortId(chosen.trace.manifest.traceId),
    flowRefusal: chosen.trace?.refusal ?? null,
    measures: Object.freeze(measures),
    control: lastTest !== undefined && firstExecution !== undefined ? flowControl(lastTest.calls, firstExecution.calls, domain) : null,
    self: selfWalk(explorationCalls(exploration, "first"), domain),
    trials: Object.freeze(tests.map((trial) => measureTrial(trial, buildRecording(explorationCalls(exploration, "first"), domain), domain, trialVerdicts))),
    pairs: Object.freeze(flowPairs([...tests, ...executions], domain, withOracle(trialVerdicts, executions, run))),
  });
}

/** What each live run's judge said, with the run's last execution judged by the Lab's oracle: `yes` for passed, `no` for failed. */
function withOracle(trialVerdicts: ReadonlyMap<string, string>, executions: readonly StoreTrace[], run: LabRunRecord): ReadonlyMap<string, string> {
  const last = executions.filter((execution) => execution.calls.length > 0).at(-1);
  if (last === undefined || run.oracleVerdict === null) return trialVerdicts;
  return new Map([...trialVerdicts, [last.manifest.episodeId, run.oracleVerdict === "passed" ? "yes" : "no"]]);
}

/** Each live Flow run over the one before it, in time order: what a later attempt's simulation would have had to read. */
function flowPairs(runs: readonly StoreTrace[], domain: ClientGatewayTraceStateDomain, trialVerdicts: ReadonlyMap<string, string>): readonly FlowPairMeasure[] {
  const ordered = [...runs].filter((run) => run.calls.length > 0).sort((left, right) => left.manifest.startedAt.localeCompare(right.manifest.startedAt));
  const pairs: FlowPairMeasure[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const from = ordered[index - 1]!;
    const to = ordered[index]!;
    const fromCalls = flowCalls(from.calls);
    const toCalls = flowCalls(to.calls);
    const { tally, verdict } = walkFlow({ flow: toCalls, recording: buildRecording(fromCalls, domain), domain, options: { skippedActs: "gap" } });
    pairs.push(Object.freeze({
      from: shortId(from.manifest.traceId), to: shortId(to.manifest.traceId),
      fromActivity: from.manifest.activity, toActivity: to.manifest.activity,
      liveFrom: trialVerdicts.get(from.manifest.episodeId) ?? null, liveTo: trialVerdicts.get(to.manifest.episodeId) ?? null,
      sameCommands: fromCalls.length === toCalls.length && fromCalls.every((call, position) => domain.canonicalKey(call.operation) === domain.canonicalKey(toCalls[position]!.operation)),
      tally, verdict,
    }));
  }
  return pairs;
}

function chooseFlow(exploration: StoreTrace, tests: readonly StoreTrace[], executions: readonly StoreTrace[]): { flow: FlowSource; calls: readonly ClientGatewayTraceStateRecordedCall[]; trace: StoreTrace | null } {
  const lastTest = tests.at(-1);
  if (lastTest !== undefined) return { flow: "last_live_test", calls: lastTest.calls, trace: lastTest };
  // A legacy build's replay: the execution with the most commands, since an aborted one holds only its first look.
  const longest = [...executions].sort((left, right) => right.calls.length - left.calls.length)[0];
  if (longest !== undefined && longest.calls.length > 0) return { flow: "execution", calls: longest.calls, trace: longest };
  const dryRun = lastDryRun(exploration);
  if (dryRun.length > 0) return { flow: "dry_run", calls: dryRun, trace: null };
  return { flow: "none", calls: [], trace: null };
}

function measureTrial(trial: StoreTrace, recording: ClientGatewayTraceStateRecording, domain: ClientGatewayTraceStateDomain, trialVerdicts: ReadonlyMap<string, string>): TrialMeasure {
  const { tally, verdict } = walkFlow({ flow: flowCalls(trial.calls), recording, domain, options: { skippedActs: "gap" } });
  return Object.freeze({
    traceId: shortId(trial.manifest.traceId),
    liveVerdict: trialVerdicts.get(trial.manifest.episodeId) ?? null,
    verdict: verdict.verdict, reasons: verdict.reasons,
    commands: tally.commands, answered: tally.answered,
  });
}

function selfWalk(calls: readonly ClientGatewayTraceStateRecordedCall[], domain: ClientGatewayTraceStateDomain): SelfWalk | null {
  if (calls.length === 0) return null;
  const receipts = traceStateReceipts(calls, domain);
  const recording = clientGatewayTraceStateRecording({ calls, domain, receipts });
  const { tally, verdict } = walkFlow({ flow: calls, recording, domain, options: { skippedActs: "gap" } });
  const beforeResult = recording.resultEntry ?? Number.POSITIVE_INFINITY;
  const moved = new Set(recording.entries.flatMap((entry) => (entry.kind === "page_move" && entry.nodeAfter !== entry.node && entry.index < beforeResult ? [entry.index] : [])));
  const mutations = traceStateMutations(calls, domain, new Set(receipts.keys()), moved).map(({ mutation, flow }) => {
    const walked = walkFlow({ flow, recording, domain, options: { skippedActs: "gap" } });
    return Object.freeze({ mutation, verdict: walked.verdict.verdict, reasons: walked.verdict.reasons });
  });
  return Object.freeze({ tally, verdict, mutations: Object.freeze(mutations) });
}

function shortId(traceId: string): string {
  return traceId.slice(-8);
}
