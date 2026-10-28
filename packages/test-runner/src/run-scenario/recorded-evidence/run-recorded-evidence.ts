// The recorded-evidence lane's first act on a live run (t770-D1), wired to the running Lab: the
// person records the scripted demonstration in the real extension, the site is put back as the
// build starts from it, and the recording is ready to attach to the chat message.
//
// The lane's own order and checks are `flow-lane/creation/recorded-evidence/`; this file only
// supplies what it needs from the running browser and Core.

import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import type { ExpectedFact, ScenarioDemonstration, ScenarioStep, WebScenario, ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import type { RunningTopology } from "../../coordinator.js";
import { extensionViewPanelControls, extensionViewPanelDriver } from "../../extension-chat-check/index.js";
import {
  attachRecordedDemonstration, judgeExactExtract, judgeRatedExtract, readResultsPages, recordDemonstration, resetScenarioLab,
  type CreatedFlowRequest, type DemonstrationExtractVerdict, type RecordedDemonstration,
} from "../../flow-lane/index.js";
import { pollStatus } from "../../run-lifecycle/index.js";
import type { ExtractionStepRead } from "../../run-expectations/index.js";
import { createExtractionIntentDriver, createScriptedNavigationDriver, ScenarioStepRunner } from "../../scenario-steps/index.js";
import { assertExpectedFacts, playwrightScenarioFactProbe } from "../../scenario-assertions.js";
import { activateScenarioTab } from "../browser-session/index.js";
import { openScenarioStart } from "../open-scenario-start.js";
import { assertPanelOnScreen, type PanelOnScreen } from "../chat-build/index.js";

/** The panel page every live panel shows, side panel or popup. */
const PANEL_PATH = "sidepanel/index.html";

export type RecordedEvidenceInput = Readonly<{
  demonstration: ScenarioDemonstration;
  /** A dry run also judges the demonstration's own extract, while the site still shows what the person did. */
  judgeExtract: boolean;
  scenario: WebScenario;
  workflow: ResolvedScenarioWorkflow;
  creation: CreatedFlowRequest;
  context: BrowserContext;
  page: Page;
  extensionControl: Page;
  livePanel: PanelOnScreen;
  topology: RunningTopology;
  isScenarioUrl: (url: string) => boolean;
  /** The facts the start page shows when it loads unarmed. */
  startFacts: readonly ExpectedFact[];
  picture: (moment: "recording" | "stopped" | "returned") => Promise<void>;
}>;

export type RecordedEvidence = Readonly<{
  recorded: RecordedDemonstration;
  /** The verdict on the demonstration's own extract, when `judgeExtract` asked for it. */
  extract?: DemonstrationExtractVerdict;
  /** Presses Attach a recording, the item named by the description, and reads the chip. */
  attach(): Promise<void>;
}>;

export async function runRecordedEvidence(input: RecordedEvidenceInput): Promise<RecordedEvidence> {
  assertPanelOnScreen(input.livePanel);
  const { control, projectId } = input.topology;
  if (!control || !projectId) throw new RunnerFailure("environment.missing", "The recorded-evidence lane needs an authenticated isolated Core and its independent project");
  const panel = extensionViewPanelControls(input.extensionControl, PANEL_PATH);
  const chat = extensionViewPanelDriver(input.extensionControl, PANEL_PATH);
  const origin = input.topology.scenarioOrigin;
  let extract: DemonstrationExtractVerdict | undefined;
  const recorded = await recordDemonstration({
    demonstration: input.demonstration, projectId, panel, core: control,
    selectProject: async (id) => {
      await control.selectProject(id);
      await chat.selectProject(id);
    },
    focusScenario: async () => {
      await input.page.bringToFront();
      await activateScenarioTab(input.extensionControl, origin);
    },
    untilRecording: async () => { await pollStatus(input.extensionControl, (status) => status.recordingState === "recording"); },
    untilStopped: async () => { await pollStatus(input.extensionControl, (status) => status.recordingState !== "recording"); },
    playSteps: (steps) => playSteps(input, steps),
    ...(input.judgeExtract ? { afterRecording: async (made: RecordedDemonstration) => { extract = await judgeExtract(input, made); } } : {}),
    returnToStart: async () => {
      await resetScenarioLab(origin, input.topology.allocation.controllerToken);
      for (const other of input.context.pages()) if (other !== input.page && !other.isClosed() && input.isScenarioUrl(other.url())) await other.close();
      await openScenarioStart(input.page, origin, input.scenario);
      await assertExpectedFacts(input.startFacts, playwrightScenarioFactProbe(input.page));
    },
    picture: input.picture,
  });
  return Object.freeze({ recorded, ...(extract ? { extract } : {}), attach: () => attachRecordedDemonstration(panel, recorded.description) });
}

/** A step runner on the scenario page; `recording` has the extension's own read take part, otherwise the reference reader reads. */
function stepRunner(input: RecordedEvidenceInput, recording: boolean): ScenarioStepRunner {
  return new ScenarioStepRunner({
    context: input.context, page: input.page, origin: input.topology.scenarioOrigin, isScenarioUrl: input.isScenarioUrl,
    uploadDirectory: path.join(input.topology.allocation.runRoot, "scenario-uploads"),
    scriptedNavigation: createScriptedNavigationDriver(input.extensionControl),
    ...(recording ? { extractionIntent: createExtractionIntentDriver(input.extensionControl) } : {}),
  });
}

/**
 * A recording cannot carry a paged read: the runner refuses an extract step that pages, because a
 * recording would store a one-page read in place of the paged one. The person demonstrates the
 * list's first page, as `everything-store/tests/demonstrations.test.ts` does, and the paging is left
 * to the sweep that judges the extract.
 */
function recordable(step: ScenarioStep): ScenarioStep {
  if (step.operation !== "extract" || step.pagination === undefined) return step;
  const { pagination: _paged, ...single } = step;
  return single;
}

/** The demonstration's steps as trusted input the extension records, with what each extract step read. */
async function playSteps(input: RecordedEvidenceInput, steps: readonly ScenarioStep[]): Promise<ReadonlyMap<string, ExtractionStepRead>> {
  const runner = stepRunner(input, true);
  const reads = new Map<string, ExtractionStepRead>();
  try {
    for (const step of steps) {
      const { extraction } = await runner.run(recordable(step));
      if (extraction) reads.set(step.id, extraction);
    }
    return reads;
  } finally { runner.dispose(); }
}

/** One results page's records, read the way the demonstration reads them but by the reference reader, since nothing is recording now. */
async function readPageRecords(input: RecordedEvidenceInput, step: ScenarioStep): Promise<ReadonlyArray<Readonly<Record<string, string>>>> {
  const runner = stepRunner(input, false);
  try { return (await runner.run(recordable(step))).extraction?.records as ReadonlyArray<Readonly<Record<string, string>>> ?? []; }
  finally { runner.dispose(); }
}

/** The recorded extract against the task's expected dataset: exact, or the person's reading of stars and accessories (everything-store). It reports; the caller fails the run, once the verdict is on record. */
async function judgeExtract(input: RecordedEvidenceInput, made: RecordedDemonstration): Promise<DemonstrationExtractVerdict> {
  const { judgement } = input.creation;
  if (judgement.judgeBy !== "expected-dataset") throw new RunnerFailure("fixture.invalid", `Task ${input.creation.task.id} is judged by a playback goal, so its demonstration has no extract to judge`);
  const expected = input.workflow.expected.extracted?.find((entry) => entry.step === judgement.stepId)?.records ?? [];
  const step = input.demonstration.steps.find((candidate) => candidate.id === judgement.stepId && candidate.operation === "extract");
  if (!step) throw new RunnerFailure("fixture.invalid", `Demonstration ${input.demonstration.id} has no extract step ${judgement.stepId}, the task's expected dataset`);
  const expectedRecords = expected as ReadonlyArray<Readonly<Record<string, string>>>;
  if (input.scenario.id === "everything-store") {
    const swept = await readResultsPages(activePage(input), () => readPageRecords(input, step));
    process.stderr.write(`[lab] demonstration sweep: ${swept.pages.map((counted, index) => `page ${index + 1}: ${counted.cards} cards, ${counted.records} couponed`).join("; ")}\n`);
    return judgeRatedExtract(judgement.stepId, swept.records, swept.cards, expectedRecords);
  }
  const read = (made.reads as ReadonlyMap<string, ExtractionStepRead>).get(judgement.stepId);
  if (!read) throw new RunnerFailure("runtime.behavior", `The demonstration read nothing at extract step ${judgement.stepId}`, { details: { fact: "demonstration.extract" } });
  return judgeExactExtract(judgement.stepId, read.records as ReadonlyArray<Readonly<Record<string, string>>>, expectedRecords);
}

function activePage(input: RecordedEvidenceInput): Page {
  const open = input.context.pages().filter((candidate) => !candidate.isClosed() && input.isScenarioUrl(candidate.url()));
  return open.includes(input.page) ? input.page : open[open.length - 1] ?? input.page;
}
