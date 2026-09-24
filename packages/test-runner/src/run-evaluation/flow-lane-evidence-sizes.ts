import { readFileSync } from "node:fs";
import path from "node:path";
import { RUN_EVIDENCE_BAND_KEY_PATTERN, type RunEvidencePacketComposition, type RunEvidenceSizes } from "@fluxiq-web-extension/test-contracts";
import type { PersistedEvidencePacket } from "../flow-lane/index.js";

/** Where the Flow lane writes what it observed, relative to the bundle (`run-scenario.ts`, `flowLaneSnapshot`). */
const FLOW_LANE_SNAPSHOT = path.join("snapshots", "flow-lane.json");

/**
 * One measured packet and where it was captured, and nothing it contained:
 * `actionPosition` is the 1-based position of its action in the snapshot's
 * `actions`, which is the Flow's action order, and `point` is the capture point
 * the lane wrote, or `null` for an entry naming no point the lane writes, so a
 * malformed entry's text is never carried onward.
 *
 * `composition` is what the packet said it was made of, in counts per relevance
 * band, or `null` for a packet that said nothing -- which is every packet in a
 * bundle written before the domain counted them.
 */
export type MeasuredEvidencePacket = { actionPosition: number; point: PersistedEvidencePacket["point"] | null; bytes: number; truncated: boolean; composition: RunEvidencePacketComposition | null };

/**
 * A Flow-lane run's evidence sizes, and the located packets they were read
 * from. `evaluateObservedRun` copies only the `RunEvidenceSizes` fields into the
 * evaluation; `packets` is what the budget check reads (`evidence-budget-invariant.ts`).
 */
export type FlowLaneEvidence = RunEvidenceSizes & { packets: MeasuredEvidencePacket[] };

/** Every point the lane writes, exhaustively: adding or removing one in `PersistedEvidencePacket` fails to compile here. */
const PACKET_POINTS = { beforeAction: true, afterAction: true } satisfies Record<PersistedEvidencePacket["point"], true>;

/**
 * The evidence sizes in a Flow-lane bundle's `snapshots/flow-lane.json`: one
 * `sanitizedPacketBytes` entry per measured packet, in action order and then
 * capture order, and a `truncationCount` of the packets the domain trimmed.
 * Neither the observation `runScenario` publishes nor `run.json` carries the
 * packets, so the bundle is the only source (`flow-lane/persisted-flow-run.ts`,
 * `PersistedEvidencePacket`). The same packets, located, are returned as
 * `packets`.
 *
 * `packetComposition` runs alongside `sanitizedPacketBytes`, one entry per
 * packet in the same order, and answers the question a byte size cannot: how
 * many elements of each relevance band the model was shown, and how many the
 * packet left behind. It was added after live run `run-muexhp0k-73172f73`,
 * whose Flow failed to click a filter its instruction named with no artifact
 * able to say whether the model had ever been shown it.
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
export function flowLaneEvidenceSizes(bundlePath: string): FlowLaneEvidence {
  // Positions count every entry of `actions`, so a position always names the file's own entry.
  const packets = snapshotActions(bundlePath).flatMap((action, index) =>
    isRecord(action) && Array.isArray(action.evidencePackets)
      ? action.evidencePackets.filter(isMeasuredPacket).map((packet): MeasuredEvidencePacket => ({ actionPosition: index + 1, point: isPacketPoint(packet.point) ? packet.point : null, bytes: packet.bytes, truncated: packet.truncated, composition: measuredComposition(packet.composition) }))
      : []);
  return {
    sanitizedPacketBytes: packets.map((packet) => packet.bytes),
    rawSnapshotBytes: [],
    packetComposition: packets.map((packet) => packet.composition),
    truncationCount: packets.filter((packet) => packet.truncated).length,
    packets
  };
}

function snapshotActions(bundlePath: string): unknown[] {
  try {
    const snapshot: unknown = JSON.parse(readFileSync(path.join(bundlePath, FLOW_LANE_SNAPSHOT), "utf8"));
    return isRecord(snapshot) && Array.isArray(snapshot.actions) ? snapshot.actions : [];
  } catch {
    return [];
  }
}

/**
 * The composition a bundle entry carries, kept only in the shape the contract
 * states. `persisted-flow-run.ts` already filtered the band keys when it wrote
 * the bundle, and this read filters again rather than trusting it: a bundle on
 * disk can be older than that filter, or edited, and this reader is the last
 * thing between it and an evaluation.
 */
function measuredComposition(value: unknown): RunEvidencePacketComposition | null {
  if (!isRecord(value)) return null;
  const included = bandCounts(value.included);
  const dropped = bandCounts(value.dropped);
  return included && dropped ? { included, dropped } : null;
}

function bandCounts(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const counts: Record<string, number> = {};
  for (const [band, count] of Object.entries(value)) {
    if (RUN_EVIDENCE_BAND_KEY_PATTERN.test(band) && typeof count === "number" && Number.isSafeInteger(count) && count >= 0) counts[band] = count;
  }
  return counts;
}

const isMeasuredPacket = (value: unknown): value is Record<string, unknown> & Pick<PersistedEvidencePacket, "bytes" | "truncated"> =>
  isRecord(value) && typeof value.bytes === "number" && Number.isSafeInteger(value.bytes) && value.bytes >= 0 && typeof value.truncated === "boolean";

const isPacketPoint = (value: unknown): value is PersistedEvidencePacket["point"] => typeof value === "string" && Object.hasOwn(PACKET_POINTS, value);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
