import { readFileSync } from "node:fs";
import path from "node:path";
import type { RunEvaluation, RunEvidenceSizes, RunManifest } from "@fluxiq-web-extension/test-contracts";
import type { PersistedEvidencePacket, RunLaneObservation } from "../flow-lane/index.js";
import { evaluateObservedRun } from "./observed-run-evaluation.js";
import { runOutcome } from "./run-outcome.js";

/** One evidence event, as far as an evaluation cares: which trigger closed the run, and at what sequence. */
export type RunClosingEvent = { sequence: number; trigger: string };

export type SingleRunInput = {
  runId: string;
  verdict: "passed" | "failed";
  /** The runner's raw failure category; absent on a pass. */
  failureCategory: string | undefined;
  scenarioId: string;
  /** `undefined` for the manifest's primary workflow, which the evaluation records as `null`. */
  workflowId: string | undefined;
  /** `undefined` when no variant was armed. */
  variantId: string | undefined;
  /** What the lane that ran this run observed. */
  observation: RunLaneObservation;
  /** The `run.json` the run just wrote. */
  manifest: RunManifest | undefined;
  /** The metrics the run finalizes its bundle with. */
  metrics: Record<string, number>;
  /** The run's evidence events, in order. */
  events: readonly RunClosingEvent[];
  /** The runner's own wall clock, used when `run.json` has no usable finish time. */
  wallClockMs: number;
  /**
   * The directory the run's evidence bundle is being written into
   * (`EvidenceBundle.stagingPath`, which `finalize` renames). A Flow-lane run's
   * evidence sizes are read from its `snapshots/flow-lane.json`, the file the
   * bench reads from the finalized bundle. Absent, no evidence size is read.
   */
  bundlePath?: string;
};

/** Where the Flow lane writes what it observed, relative to the bundle (`run-scenario.ts`, `flowLaneSnapshot`). */
const FLOW_LANE_SNAPSHOT = path.join("snapshots", "flow-lane.json");

/**
 * One scenario run's `RunEvaluation` — the same judgement `lab bench` records
 * per corpus row, for a run that was never part of a corpus.
 *
 * It exists because a `RunEvaluation` had no producer outside the bench, so
 * the only way to learn whether a run was good was to run the whole corpus.
 * Every automation field comes from the `RunLaneObservation` the lane
 * published, which until now nothing read: on the recording lane that is the
 * fixture oracle's own verdict and the Core probe's outcome, and on the Flow
 * lane the persisted Core run's.
 *
 * A Flow-lane run's evidence sizes come from the `snapshots/flow-lane.json` in
 * its bundle, the file the bench's Flow lane reads (`bench/evaluate-run.ts`,
 * `evaluateFlowRun`), so one run and its bench row record the same packets. A
 * recording-lane run contributes none, as on the bench.
 *
 * A single run is always `repeatIndex: 0` — it is nobody's replay — and it
 * scores against the resolved workflow's own `expected.failure`, which the
 * lane already carries on its observation.
 */
export function singleRunEvaluation(input: SingleRunInput): RunEvaluation {
  const evidence = input.observation.lane === "flow" && input.bundlePath !== undefined ? flowLaneEvidenceSizes(input.bundlePath) : undefined;
  return evaluateObservedRun({
    identity: {
      scenarioId: input.scenarioId,
      workflowId: input.workflowId ?? null,
      variantId: input.variantId ?? null,
      repeatIndex: 0,
      expectedFailure: input.observation.automationFailureExpected,
    },
    outcome: runOutcome({
      runId: input.runId,
      verdict: input.verdict,
      failureCategory: input.failureCategory,
      metrics: input.metrics,
      manifest: input.manifest,
      wallClockMs: input.wallClockMs,
      ...closingSequences(input.events),
    }),
    observation: input.observation,
    ...(evidence ? { evidence } : {}),
  });
}

/**
 * The `final` event closes a pass and the last `error` event closes a failure.
 * Read from the events in memory rather than from the journal on disk, and by
 * the same rule the bench applies to `events.ndjson`, so the two agree.
 */
function closingSequences(events: readonly RunClosingEvent[]): { finalSequence: number | undefined; errorSequence: number | undefined } {
  let finalSequence: number | undefined;
  let errorSequence: number | undefined;
  for (const event of events) {
    if (event.trigger === "final") finalSequence = event.sequence;
    else if (event.trigger === "error") errorSequence = event.sequence;
  }
  return { finalSequence, errorSequence };
}

/**
 * The evidence sizes in a Flow-lane bundle's `snapshots/flow-lane.json`: one
 * `sanitizedPacketBytes` entry per measured packet, in action order and then
 * capture order, and a `truncationCount` of the packets the domain trimmed.
 *
 * The bench holds the same read in `bench/evaluate-run.ts`, which imports this
 * module and so cannot be imported from it. `tests/single-run-evaluation.test.ts`
 * evaluates one bundle both ways, well-formed and malformed, and fails if the
 * two ever record different sizes.
 *
 * An absent file is a run in which no Flow ran, and yields none. So does a file
 * that cannot be read or parsed, and so does an entry that is not a packet the
 * lane writes: a size the evaluation contract rejects must not throw after the
 * run has finished. `rawSnapshotBytes` stays empty, because no producer
 * measures raw snapshots and they are not a Week 1 metric.
 */
function flowLaneEvidenceSizes(bundlePath: string): RunEvidenceSizes {
  const packets = snapshotActions(bundlePath).flatMap((action) => Array.isArray(action.evidencePackets) ? action.evidencePackets.filter(isMeasuredPacket) : []);
  return { sanitizedPacketBytes: packets.map((packet) => packet.bytes), rawSnapshotBytes: [], truncationCount: packets.filter((packet) => packet.truncated).length };
}

function snapshotActions(bundlePath: string): Array<Record<string, unknown>> {
  try {
    const snapshot: unknown = JSON.parse(readFileSync(path.join(bundlePath, FLOW_LANE_SNAPSHOT), "utf8"));
    return isRecord(snapshot) && Array.isArray(snapshot.actions) ? snapshot.actions.filter(isRecord) : [];
  } catch {
    return [];
  }
}

const isMeasuredPacket = (value: unknown): value is Pick<PersistedEvidencePacket, "bytes" | "truncated"> =>
  isRecord(value) && typeof value.bytes === "number" && Number.isSafeInteger(value.bytes) && value.bytes >= 0 && typeof value.truncated === "boolean";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
