import { readFileSync } from "node:fs";
import path from "node:path";
import type { RunEvidenceSizes } from "@fluxiq-web-extension/test-contracts";
import type { PersistedEvidencePacket } from "../flow-lane/index.js";

/** Where the Flow lane writes what it observed, relative to the bundle (`run-scenario.ts`, `flowLaneSnapshot`). */
const FLOW_LANE_SNAPSHOT = path.join("snapshots", "flow-lane.json");

/**
 * The evidence sizes in a Flow-lane bundle's `snapshots/flow-lane.json`: one
 * `sanitizedPacketBytes` entry per measured packet, in action order and then
 * capture order, and a `truncationCount` of the packets the domain trimmed.
 * Neither the observation `runScenario` publishes nor `run.json` carries the
 * packets, so the bundle is the only source (`flow-lane/persisted-flow-run.ts`,
 * `PersistedEvidencePacket`).
 *
 * Both Flow-lane producers of a `RunEvaluation` read through this one function,
 * so a run and its bench row record the same packets: the bench from the
 * finalized bundle (`bench/evaluate-run.ts`, `evaluateFlowRun`), and a single
 * `lab run` from the staging directory before `finalize` renames it
 * (`single-run-evaluation.ts`).
 *
 * An absent file is a run in which no Flow ran, and yields none. So does a file
 * that cannot be read or parsed, and so does an entry that is not a packet the
 * lane writes: the contract has no way to say "unmeasured", and a size the
 * contract would reject must not throw after the run has finished or in the
 * middle of a bench. `rawSnapshotBytes` stays empty, because no producer
 * measures raw snapshots and they are not a Week 1 metric.
 */
export function flowLaneEvidenceSizes(bundlePath: string): RunEvidenceSizes {
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
