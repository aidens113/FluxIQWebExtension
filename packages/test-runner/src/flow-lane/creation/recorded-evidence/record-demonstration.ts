import type { ScenarioDemonstration, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import type { PanelControls } from "../../../extension-chat-check/index.js";
import { awaitFinalizedRecording, type FinalizedRecording, type FinalizedRecordingControl } from "../../finalized-recording.js";
import { recordingIds } from "../../../run-scenario/core-round-trip/recording-ids.js";
import { recordingItems } from "./recording-set-change.js";

const PRESS_MS = 30_000;
const APPEAR_MS = 30_000;
/**
 * Core appends a long demonstration's entries at about one a second (job-board's, 142 entries and still growing at the default
 * 90 s bound, run-mvror0oc-6dc116bf), so the wait for it to finish is longer than a Flow lane's one-minute recordings need.
 */
const FINALIZE_MS = 300_000;

/** What the lane needs from the running Lab; each member is a seam the tests fake. */
export type DemonstrationRecordingDeps = Readonly<{
  demonstration: ScenarioDemonstration;
  projectId: string;
  panel: PanelControls;
  core: FinalizedRecordingControl & { listRecordings(projectId: string): Promise<unknown> };
  /** Makes the project the extension records into the one the build uses, in Core and in the panel. */
  selectProject(projectId: string): Promise<void>;
  /** Brings the scenario's tab in front and tells the extension it is the automation tab. */
  focusScenario(): Promise<void>;
  /** Resolves once the extension reports it is recording. */
  untilRecording(): Promise<void>;
  /** Resolves once the extension reports it has stopped. */
  untilStopped(): Promise<void>;
  /** Runs the steps on the scenario page as trusted input the extension records; answers what its extract steps read, by step id. */
  playSteps(steps: readonly ScenarioStep[]): Promise<ReadonlyMap<string, unknown>>;
  /** Judges what was read, after the recording is finalized and before the site is reset; the dry run's own check. */
  afterRecording?(recorded: RecordedDemonstration): Promise<void>;
  /** Resets the site to the state the build starts from and returns to the start page. */
  returnToStart(): Promise<void>;
  /** Puts a moment on the run's timeline. Must not throw. */
  picture(moment: "recording" | "stopped" | "returned"): Promise<void>;
  wait?: Readonly<{ appearMs?: number; finalizeMs?: number }>;
}>;

export type RecordedDemonstration = Readonly<{
  recordingId: string;
  description: string;
  finalized: FinalizedRecording;
  reads: ReadonlyMap<string, unknown>;
  /** The project's recording ids before the demonstration was made. */
  before: ReadonlySet<string>;
}>;

/**
 * The person's first act in a recorded-evidence build: record the scripted demonstration in the
 * real extension, through the panel, and leave the site as the build will find it.
 *
 * Start recording, describe it, run the demonstration's steps on the scenario page, Stop; then
 * exactly one new recording must appear in the project, finalized, carrying that description. The
 * site is then reset and the start page reopened, because the demonstration's acts (a coupon
 * applied, a filter ticked) are the person's and the build starts from the site as it was.
 */
export async function recordDemonstration(deps: DemonstrationRecordingDeps): Promise<RecordedDemonstration> {
  const description = deps.demonstration.description.trim();
  const before = recordingIds(await deps.core.listRecordings(deps.projectId));
  await deps.selectProject(deps.projectId);
  await deps.focusScenario();
  await deps.panel.pressNamed("Start recording", PRESS_MS);
  await deps.panel.fillLabelled("Recording description", description, PRESS_MS);
  await deps.panel.pressNamed("Start described recording", PRESS_MS);
  await deps.untilRecording();
  await deps.picture("recording");
  const reads = await deps.playSteps(deps.demonstration.steps);
  await deps.panel.pressNamed("Stop recording", PRESS_MS);
  await deps.untilStopped();
  const recordingId = await newRecordingId(deps, before, deps.wait?.appearMs ?? APPEAR_MS);
  const finalized = await awaitFinalizedRecording(deps.core, { projectId: deps.projectId, recordingId }, {}, { timeoutMs: deps.wait?.finalizeMs ?? FINALIZE_MS });
  const stored = recordingItems(await deps.core.listRecordings(deps.projectId)).find((item) => (item.recordingId ?? item.id) === recordingId);
  if ((typeof stored?.description === "string" ? stored.description.trim() : "") !== description) {
    throw new RunnerFailure("recording.persistence", `Core holds the demonstration's recording ${recordingId} without the description the person gave it`, { details: { fact: "recording.described" } });
  }
  await deps.picture("stopped");
  const recorded: RecordedDemonstration = Object.freeze({ recordingId, description, finalized, reads, before });
  await deps.afterRecording?.(recorded);
  await deps.returnToStart();
  await deps.picture("returned");
  return recorded;
}

async function newRecordingId(deps: DemonstrationRecordingDeps, before: ReadonlySet<string>, appearMs: number): Promise<string> {
  const deadline = Date.now() + appearMs;
  for (;;) {
    const added = [...recordingIds(await deps.core.listRecordings(deps.projectId))].filter((id) => !before.has(id));
    if (added.length > 1) throw new RunnerFailure("recording.persistence", `${added.length} new recordings appeared for one demonstration; exactly one is expected`, { details: { fact: "recording.set", added: added.length } });
    if (added.length === 1) return added[0]!;
    if (Date.now() >= deadline) throw new RunnerFailure("recording.persistence", `Core persisted no new recording within ${Math.round(appearMs / 1000)} s of Stop`, { details: { fact: "recording.set", added: 0 } });
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
