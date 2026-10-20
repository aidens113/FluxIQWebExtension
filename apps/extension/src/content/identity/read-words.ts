// The words a read step reads are its value, not its identity (t743, D2b).
//
// A step that reads an element's text -- an extract in text, value or html
// mode, a text assertion -- saves its target with the words it was captured
// with, marked `readsWords: true` (`domain/.../plan-resolution/read-identity.ts`).
// The words are a true description of the element as captured, and the
// save-time guard counts them; but the step exists to read them, and an earlier
// step of the same Flow may have changed them -- a total after a discount, the
// address line after a delivery choice. Office rerun round 4
// (`run-mvgvyaip-d856e135`, 0055) failed exactly there: the selector found the
// paragraph, and the veto refused it for showing the new address.
//
// So for a marked target the words never veto or penalise a candidate:
// `veto.ts` and `score.ts` judge it by `unworded` -- its selector, record,
// dialog, label, ids, classes and kind -- and the words only break a tie
// among candidates that otherwise match equally, or confirm a winner nothing
// else confirms (`agrees`). A target that is not marked is returned as
// `undefined`, and every press keeps today's behaviour exactly.
//
// **Which words are the value read.** The visible text, and an accessible name
// that says the same as it. The packet drops an element's text where it equals
// its name, so a name that arrives with no text beside it may be the words
// themselves and is treated as them. A name shown beside *different* words --
// an `aria-label`, a title -- is the element's own: it stays in `unworded` and
// still has to agree, as it would on any target.

import type { RecordedIdentity } from "./score";
import { normalizedText } from "./normalized-text";

/** What a candidate offers to compare a read's words against: Core's fingerprint fields of the same names. */
type Worded = { visibleText?: string | undefined; accessibleName?: string | undefined };

/**
 * A read target split into what decides it and the words it reads, or
 * `undefined` when `target` is not marked as reading its words (header).
 */
export function readWordsOf(target: RecordedIdentity): { unworded: RecordedIdentity; words: readonly string[]; agrees: (candidate: Worded) => boolean } | undefined {
  if (target.readsWords !== true) return undefined;
  const { visibleText, accessibleName, readsWords: _marked, ...rest } = target;
  const unworded: RecordedIdentity = { ...rest };
  const text = comparable(visibleText);
  const name = comparable(accessibleName);
  // A name beside different words is the element's own; one alone, or one saying the words again, is the words (header).
  if (name !== undefined && text !== undefined && name !== text) unworded.accessibleName = accessibleName;
  const word = text ?? name;
  const words: readonly string[] = word === undefined ? [] : [word];
  const agrees = (candidate: Worded): boolean => {
    const shown = [comparable(candidate.visibleText), comparable(candidate.accessibleName)];
    return words.some((word) => shown.includes(word));
  };
  return { unworded, words, agrees };
}

/** Words as a comparison reads them: spacing collapsed, case ignored. */
function comparable(value: string | undefined): string | undefined {
  return normalizedText(value)?.toLowerCase();
}
