// The Week 2 end-to-end UI suite: the journeys under `journeys/`, composed into
// one run and folded into one result (`suite-outcome.ts`).
//
// Provider-free lane, in order:
// - F1 record, Generate Subflow, run, watch Runtime Debug (`runFirstRunJourney`).
// - F2 extraction (`runExtractionJourney`).
// - F3 failure presentation (`runFailurePresentationJourney`).
// - F4 restart and reuse (`runRestartReuseJourney`) of the Flows F2 and F3 saved.
//
// Provider lane: nothing here calls a provider. Unless the provider lane is
// selected every provider journey is `not_run` / `provider_lane_not_selected`;
// when it is, P6 is `not_built` (no product UI) and P1-P5 are `not_run` /
// `journey_not_wired`. A selected journey that is not `verified` fails the suite.
import type { DemoWorkspaceConfiguration } from "../demo-workspace/index.js";
import {
  type ExtractionJourneyResult, type FailurePresentationJourneyResult, type FirstRunJourneyResult, type JourneyCheckpoint, type RestartReuseJourneyResult,
  runExtractionJourney, runFailurePresentationJourney, runFirstRunJourney, runRestartReuseJourney, type SavedJourneyFlow,
} from "./journeys/index.js";
import { selectUiE2eJourneys, type UiE2eJourneyDefinition, type UiE2eJourneyId, type UiE2eLaneSelection } from "./journey-selection.js";
import { failedOutcome, foldUiE2eSuite, type UiE2eFacts, type UiE2eJourneyOutcome, type UiE2eSuiteResult, unmeasuredOutcome } from "./suite-outcome.js";

/** The journeys that drive a real Core and browser; replaced in tests. */
export type UiE2eJourneyDrivers = Readonly<{
  firstRun: (config: DemoWorkspaceConfiguration) => Promise<FirstRunJourneyResult>;
  extraction: (config: DemoWorkspaceConfiguration) => Promise<ExtractionJourneyResult>;
  failurePresentation: (config: DemoWorkspaceConfiguration) => Promise<FailurePresentationJourneyResult>;
  restartReuse: (config: DemoWorkspaceConfiguration, flows: readonly SavedJourneyFlow[]) => Promise<RestartReuseJourneyResult>;
}>;

const productionDrivers: UiE2eJourneyDrivers = Object.freeze({
  firstRun: config => runFirstRunJourney(config),
  extraction: config => runExtractionJourney(config),
  failurePresentation: config => runFailurePresentationJourney(config),
  restartReuse: (config, flows) => runRestartReuseJourney(config, flows),
});

export type UiE2eSuiteOptions = Readonly<{
  lane: UiE2eLaneSelection;
  /** The journeys named by `--journey`; empty runs every journey in the lane. */
  journeys: readonly UiE2eJourneyId[];
  /** The run-scoped workspace every journey shares (`prepareUiE2eRunConfiguration`). */
  config: DemoWorkspaceConfiguration;
  drivers?: UiE2eJourneyDrivers;
  now?: () => number;
}>;

/** What a verified journey contributes: its facts, and the Flows it saved for the restart journey. */
type Measured = Readonly<{ ids: UiE2eFacts; counts: UiE2eFacts; checkpoints: readonly JourneyCheckpoint[]; saved?: SavedJourneyFlow }>;

function timings(checkpoints: readonly JourneyCheckpoint[]): Record<string, number> {
  return Object.fromEntries(checkpoints.map(checkpoint => [checkpoint.stage, checkpoint.elapsedMs]));
}

function firstRunFacts(result: FirstRunJourneyResult): Measured {
  const { activity, runtimeDebug } = result;
  return {
    ids: result.ids,
    counts: {
      actionAttempts: runtimeDebug.core.attemptCount, actionCount: runtimeDebug.core.actionCount, providerCalls: activity.providerCalls, interventions: activity.interventions,
      runRowPresent: runtimeDebug.runRow.present, actionLogAttemptRows: runtimeDebug.reopenedLog.attemptRows, actionLogAttemptRowsMatch: runtimeDebug.reopenedLog.attemptRowsMatch,
    },
    checkpoints: result.checkpoints,
  };
}

function extractionFacts(result: ExtractionJourneyResult): Measured {
  const { judgement, picker, panel, run } = result;
  return {
    ids: { ...result.ids, scenarioId: result.scenarioId },
    counts: {
      ...picker, ...panel, actionAttempts: run.actionAttempts, providerCalls: run.providerCalls, interventions: run.interventions,
      expectedRecords: judgement.expectedRecords, observedRecords: judgement.observedRecords, matchedRecords: judgement.matchedRecords,
      expectedFields: judgement.expectedFields, presentFields: judgement.presentFields, unexpectedFields: judgement.unexpectedFields,
    },
    checkpoints: result.checkpoints,
    saved: result.saved,
  };
}

function failureFacts(result: FailurePresentationJourneyResult): Measured {
  const { presentation, run } = result;
  return {
    ids: { ...result.ids, task: result.task },
    counts: {
      actionAttempts: run.actionAttempts, failedAttempts: run.failedAttempts, failureCategory: run.failureCategory, failureCode: run.failureCode,
      providerCalls: run.providerCalls, attemptRows: presentation.attemptRows, failedAttemptRows: presentation.failedAttemptRows,
      terminalReasonShown: presentation.terminalReasonShown, terminalReasonCode: presentation.terminalReasonCode, oracleReached: result.oracleReached,
    },
    checkpoints: result.checkpoints,
    saved: result.saved,
  };
}

function restartFacts(result: RestartReuseJourneyResult): Measured {
  const ids: Record<string, string> = {};
  const counts: Record<string, number | boolean> = { webPortClosed: result.stop.webPortClosed, gatewayPortClosed: result.stop.gatewayPortClosed, portReleaseWaitedMs: result.stop.waitedMs, portProbes: result.stop.probes, flowsRerun: result.flows.length };
  for (const flow of result.flows) {
    ids[`${flow.label}RunId`] = flow.runId;
    counts[`${flow.label}ActionAttempts`] = flow.actionAttempts;
    counts[`${flow.label}ProviderCalls`] = flow.providerCalls;
    counts[`${flow.label}IdentitiesUnchanged`] = flow.identitiesUnchanged;
    if (flow.dataset) {
      counts[`${flow.label}Records`] = flow.dataset.records;
      counts[`${flow.label}MatchedRecords`] = flow.dataset.matchedRecords;
      counts[`${flow.label}Sha256Equal`] = flow.dataset.sha256Equal;
    }
  }
  return { ids, counts, checkpoints: result.checkpoints };
}

/** Runs the selected journeys in order and folds them into the suite's result. A journey's failure never stops the ones after it, except those that need its Flow. */
export async function runUiE2eSuite(options: UiE2eSuiteOptions): Promise<UiE2eSuiteResult> {
  const drivers = options.drivers ?? productionDrivers;
  const now = options.now ?? Date.now;
  const began = now();
  const selection = selectUiE2eJourneys(options);
  const outcomes: UiE2eJourneyOutcome[] = [];
  const saved = new Map<UiE2eJourneyId, SavedJourneyFlow>();

  const measure = async (definition: UiE2eJourneyDefinition, operation: () => Promise<Measured>): Promise<UiE2eJourneyOutcome> => {
    const started = now();
    try {
      const measured = await operation();
      if (measured.saved) saved.set(definition.id, measured.saved);
      return { id: definition.id, name: definition.name, lane: definition.lane, selected: true, status: "verified", reasonCode: null, failureCategory: null, durationMs: now() - started, ids: measured.ids, counts: measured.counts, timings: timings(measured.checkpoints) };
    } catch (error) {
      return failedOutcome(definition, error, now() - started);
    }
  };

  for (const { definition, selected, laneSelected } of selection.journeys) {
    if (!laneSelected) { outcomes.push(unmeasuredOutcome(definition, selected, "not_run", "provider_lane_not_selected")); continue; }
    if (!selected) { outcomes.push(unmeasuredOutcome(definition, false, "not_run", "journey_not_selected")); continue; }
    switch (definition.id) {
      case "F1": outcomes.push(await measure(definition, async () => firstRunFacts(await drivers.firstRun(options.config)))); break;
      case "F2": outcomes.push(await measure(definition, async () => extractionFacts(await drivers.extraction(options.config)))); break;
      case "F3": outcomes.push(await measure(definition, async () => failureFacts(await drivers.failurePresentation(options.config)))); break;
      case "F4": {
        const flows = definition.requires.map(id => saved.get(id));
        if (flows.some(flow => flow === undefined)) { outcomes.push(unmeasuredOutcome(definition, true, "not_run", "prerequisite_not_verified")); break; }
        outcomes.push(await measure(definition, async () => restartFacts(await drivers.restartReuse(options.config, flows as SavedJourneyFlow[]))));
        break;
      }
      case "P6": outcomes.push(unmeasuredOutcome(definition, true, "not_built", "product_ui_not_built")); break;
      default: outcomes.push(unmeasuredOutcome(definition, true, "not_run", "journey_not_wired"));
    }
  }
  return foldUiE2eSuite(options.lane, outcomes, now() - began);
}
