import { isDeepStrictEqual } from "node:util";
import type { DemonstrationExtractVerdict } from "./demonstration/index.js";

type DatasetRecord = Readonly<Record<string, string>>;

/** One result card as a person reads it: the link it opens and the stars and title beside it. */
export type ReadCard = Readonly<{ url: string; name: string; rating: string }>;

/** An accessory is a replacement part or a charging case, not a pair of earbuds. */
const ACCESSORY = /^(Replacement|Charging Case)/u;
const MIN_STARS = 4;

/**
 * Judges the demonstration's recorded extract against the task's expected dataset, exactly: the same
 * records in the same order, each field equal.
 */
export function judgeExactExtract(stepId: string, read: readonly DatasetRecord[], expected: readonly DatasetRecord[]): DemonstrationExtractVerdict {
  return verdict(stepId, "exact", read, read, expected);
}

/**
 * Everything-store's extract is every couponed card with the rating unread, because the recording
 * cannot carry the stars; the person then keeps the cards whose stars read four or more and which
 * are not accessories, in the order the store shows them. That reading is the one
 * `everything-store/tests/demonstrations.test.ts` applies, on `cards` read from the results pages
 * in order. A card whose record the extract did not hold is dropped, as there.
 */
export function judgeRatedExtract(stepId: string, read: readonly DatasetRecord[], cards: readonly ReadCard[], expected: readonly DatasetRecord[]): DemonstrationExtractVerdict {
  const kept = new Map<string, DatasetRecord>();
  for (const card of cards) {
    const record = read.find((candidate) => candidate.url === card.url);
    if (!record || Number(card.rating) < MIN_STARS || ACCESSORY.test(card.name) || kept.has(card.url)) continue;
    kept.set(card.url, record);
  }
  return verdict(stepId, "rated-non-accessory", read, [...kept.values()], expected);
}

function verdict(stepId: string, judgement: DemonstrationExtractVerdict["judgement"], read: readonly DatasetRecord[], kept: readonly DatasetRecord[], expected: readonly DatasetRecord[]): DemonstrationExtractVerdict {
  const mismatches: Array<{ position: number; kind: "missing" | "unexpected" | "different" }> = [];
  for (let index = 0; index < Math.max(kept.length, expected.length); index += 1) {
    if (index >= kept.length) mismatches.push({ position: index + 1, kind: "missing" });
    else if (index >= expected.length) mismatches.push({ position: index + 1, kind: "unexpected" });
    else if (!isDeepStrictEqual(kept[index], expected[index])) mismatches.push({ position: index + 1, kind: "different" });
  }
  return Object.freeze({ stepId, judgement, passed: expected.length > 0 && mismatches.length === 0, readCount: read.length, keptCount: kept.length, expectedCount: expected.length, mismatches });
}
