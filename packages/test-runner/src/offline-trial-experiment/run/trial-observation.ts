// What a trial's judge was shown, reduced to what can be compared and written
// down: the stored-row account, each read's counts (items seen, kept, and per
// condition the rows it rejected), each executed step's node, status, attempts
// and failure code, and where the run stopped. A live trial's feedback (the
// Lab step file of its test) and an offline trial's (the runner's outcome)
// reduce the same way, so the two can be compared field by field.
//
// Words the feedback carries (step labels, a read's account in words, the
// conditions as written) may quote the page, so they are never kept: they are
// compared only, through a SHA-256 over their canonical JSON: one for the
// reads' words, one for the steps'.

import { createHash } from "node:crypto";
import { jsonRecord } from "../json-record.js";

export type TrialObservedRead = Readonly<{ seen: number | null; kept: number | null; conditions: readonly Readonly<{ rejected: number | null; rejectedByItself: number | null }>[] }>;

export type TrialObservedStep = Readonly<{ step: number | null; definitionId: string | null; status: string | null; attempts: number | null; failureCode: string | null }>;

export type TrialObservation = Readonly<{
  code: string | null;
  stored: Readonly<{ rows: number | null; refused: number | null; missingRequired: number | null }> | null;
  reads: readonly TrialObservedRead[];
  steps: readonly TrialObservedStep[];
  /** The last step the run executed, which is where it stopped. */
  stoppedAt: TrialObservedStep | null;
  /** SHA-256 of the canonical JSON of the words the reads carry (node ids, labels, accounts, conditions) and of those the steps carry (labels, controls, notes). */
  wordsDigest: Readonly<{ reads: string; steps: string }>;
}>;

const number = (value: unknown): number | null => (typeof value === "number" ? value : null);
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const digest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function trialObservation(feedbackValue: unknown): TrialObservation {
  const feedback = jsonRecord(feedbackValue) ?? {};
  const stored = jsonRecord(feedback.stored);
  const readWords: unknown[] = [];
  const stepWords: unknown[] = [];
  const reads = list(feedback.reads).map((item): TrialObservedRead => {
    const read = jsonRecord(item) ?? {};
    readWords.push([read.nodeId, read.label, read.said, read.beforeRead, read.listContinues, read.narrowedBefore, list(read.conditions).map((condition) => jsonRecord(condition)?.condition)]);
    return Object.freeze({
      seen: number(read.seen), kept: number(read.kept),
      conditions: Object.freeze(list(read.conditions).map((condition) => {
        const named = jsonRecord(condition) ?? {};
        return Object.freeze({ rejected: number(named.rejected), rejectedByItself: number(named.rejectedByItself) });
      })),
    });
  });
  const steps = list(feedback.steps).map((item): TrialObservedStep => {
    const step = jsonRecord(item) ?? {};
    stepWords.push([step.label, step.control, step.skipped, step.happened]);
    return Object.freeze({ step: number(step.step), definitionId: text(step.definitionId), status: text(step.status), attempts: number(step.attempts), failureCode: text(step.failureCode) });
  });
  return Object.freeze({
    code: text(feedback.code),
    stored: stored ? Object.freeze({ rows: number(stored.rows), refused: number(stored.refused), missingRequired: number(stored.missingRequired) }) : null,
    reads: Object.freeze(reads),
    steps: Object.freeze(steps),
    stoppedAt: steps.at(-1) ?? null,
    wordsDigest: Object.freeze({ reads: digest(readWords), steps: digest(stepWords) }),
  });
}

/** Field by field, whether an offline observation equals the live one it is compared with. */
export type TrialObservationComparison = Readonly<{
  stored: boolean;
  reads: boolean;
  steps: boolean;
  stoppedAt: boolean;
  /** Whether the reads' words, and the steps' words, are equal (`TrialObservation.wordsDigest`). */
  words: Readonly<{ reads: boolean; steps: boolean }>;
  /** Every field above equal. The codes are not compared: a live trial's carries its judge's verdict, an offline one's says it was not judged. */
  equal: boolean;
}>;

export function compareTrialObservations(live: TrialObservation, offline: TrialObservation): TrialObservationComparison {
  const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
  const stored = same(live.stored, offline.stored);
  const reads = same(live.reads, offline.reads);
  const steps = same(live.steps, offline.steps);
  const stoppedAt = same(live.stoppedAt, offline.stoppedAt);
  const words = Object.freeze({ reads: live.wordsDigest.reads === offline.wordsDigest.reads, steps: live.wordsDigest.steps === offline.wordsDigest.steps });
  return Object.freeze({ stored, reads, steps, stoppedAt, words, equal: stored && reads && steps && stoppedAt && words.reads && words.steps });
}
