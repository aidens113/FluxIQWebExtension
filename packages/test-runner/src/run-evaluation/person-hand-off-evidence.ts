import { readFileSync } from "node:fs";
import path from "node:path";
import type { ExpectedPersonHandOff } from "@fluxiq-web-extension/test-contracts";
import { PERSON_HAND_OFF_ACTS, PERSON_HAND_OFFS_SNAPSHOT, type PersonHandOff, type PersonHandOffSnapshot } from "../person-simulation/index.js";

/**
 * A run's hand-off record as the evaluation reads it from the bundle:
 * `absent` for a run in which the Lab never played the person (a recording,
 * or a run that stopped before any Flow was built), `unreadable` for a record
 * the evaluation cannot trust, and `read` otherwise.
 */
export type PersonHandOffEvidence =
  | Readonly<{ status: "absent" }>
  | Readonly<{ status: "unreadable"; reason: string }>
  | Readonly<{ status: "read"; snapshot: PersonHandOffSnapshot }>;

/**
 * The bundle's `snapshots/person-hand-offs.json`, read the way the Flow lane's
 * evidence sizes are (`flow-lane-evidence-sizes.ts`), so a single `lab run` and
 * a bench row read the same record. It never throws: the run has finished,
 * and a record it cannot read is itself the finding.
 */
export function personHandOffEvidence(bundlePath: string): PersonHandOffEvidence {
  let raw: string;
  try {
    raw = readFileSync(path.join(bundlePath, PERSON_HAND_OFFS_SNAPSHOT), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: "absent" };
    return { status: "unreadable", reason: `the record could not be read (${(error as NodeJS.ErrnoException).code ?? "unknown"})` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { status: "unreadable", reason: `the record is not JSON (${error instanceof Error ? error.name : "unknown"})` };
  }
  const snapshot = asSnapshot(parsed);
  return snapshot ? { status: "read", snapshot } : { status: "unreadable", reason: "the record does not have the hand-off record's shape" };
}

function asSnapshot(value: unknown): PersonHandOffSnapshot | undefined {
  if (!isRecord(value) || typeof value.scenarioId !== "string" || !Array.isArray(value.handOffs) || typeof value.playable !== "boolean") return undefined;
  if (!value.handOffs.every(isHandOff)) return undefined;
  const declared = isRecord(value.expected) ? value.expected : undefined;
  const person = declared?.person === "completes" || declared?.person === "declines" ? declared.person : undefined;
  const expected: ExpectedPersonHandOff | null = person && typeof declared?.required === "boolean" && typeof declared.because === "string"
    ? { person, required: declared.required, because: declared.because }
    : null;
  return {
    scenarioId: value.scenarioId,
    expected,
    playable: value.playable,
    handOffs: value.handOffs,
    pollFailures: typeof value.pollFailures === "number" ? value.pollFailures : 0,
    lastPollFailure: typeof value.lastPollFailure === "string" ? value.lastPollFailure : null,
  };
}

function isHandOff(value: unknown): value is PersonHandOff {
  return isRecord(value) && typeof value.askId === "string" && (PERSON_HAND_OFF_ACTS as readonly unknown[]).includes(value.did)
    && (value.check === null || typeof value.check === "string") && typeof value.cleared === "boolean" && typeof value.secondsWaited === "number";
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
