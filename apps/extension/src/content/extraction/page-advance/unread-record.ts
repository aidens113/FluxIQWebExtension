// Whether the page shows an item a move brought: one saying something no item
// shown before it said (`./record-meaning.ts`).
//
// Counted, not merely looked up, so a page that appends a reply saying what an
// earlier one said ("+1") still shows one more of it. A redraw that brings the
// same items back in new elements shows nothing new (t885, R5).

import { recordMeaning } from "./record-meaning";

/** Whether `current` holds more items saying something than `before`, the meanings of the items shown before, did. */
export function unreadRecordShown(before: readonly string[], current: Iterable<Element>): boolean {
  const left = new Map<string, number>();
  for (const meaning of before) left.set(meaning, (left.get(meaning) ?? 0) + 1);
  for (const element of current) {
    const meaning = recordMeaning(element);
    const remaining = left.get(meaning) ?? 0;
    if (remaining === 0) return true;
    left.set(meaning, remaining - 1);
  }
  return false;
}
