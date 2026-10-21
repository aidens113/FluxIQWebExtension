// Reading one row with its text disclosed, for a list read that discloses text:
// every read unless it says `discloseText: false` (`../list-reader.ts`; the
// default since t752's unit C2, 2026-10-20, because such a row was always
// refused, so no read that passed before reads differently).
//
// The row is read and judged exactly as without it. Only where that refuses
// `incomplete_text` -- which the reader does on a row its conditions keep, and
// on a rejected row only where a condition that rejected it judged a collapsed
// field (`../item-record/assert-disclosed.ts`, `../item-filter.ts`) -- is the
// control that refusal names pressed (`press-disclosure.ts`), and the row read
// and judged again from the start, so a rejection that judged partial text is
// judged again on the whole text. A row rejected on other fields never refuses,
// so it is never pressed.
//
// Each control is pressed at most once. A control still collapsed after its
// press, a control this read never presses, and any other failure end the row
// as they would without disclosure: the refusal is thrown as it was.
//
// Why (t752, 2026-10-20): a read whose kept rows carried collapsed text was
// refused, and the repair it named was a second shape of Flow -- a context read,
// a press repeated over its rows, then the full read. With no conditions on the
// context read, a build pressed every row of a long list, one model step each,
// and ran out of time; the shape had failed three rounds running in three ways.

import { pressTextDisclosure } from "./press-disclosure";
import { REFUSED_DISCLOSURE_CONTROLS } from "./refused-controls";

/** The most controls one row is pressed for: one per collapsed field it reads, with room. */
const MOST_PRESSES_PER_ROW = 8;

/**
 * `attempt`'s answer for `row`, pressing the control of each `incomplete_text`
 * it refuses and trying again, and how many controls were pressed. `restore`
 * runs before each new attempt, to undo what a refused one wrote.
 */
export async function readDisclosing<T>(row: Element, attempt: () => T, deadline: number | undefined, restore: () => void): Promise<{ value: T; pressed: number }> {
  const pressed = new Set<Element>();
  for (;;) {
    try {
      return { value: attempt(), pressed: pressed.size };
    } catch (error) {
      const control = typeof error === "object" && error !== null ? REFUSED_DISCLOSURE_CONTROLS.get(error) : undefined;
      if (control === undefined || pressed.has(control) || pressed.size >= MOST_PRESSES_PER_ROW) throw error;
      if (!(await pressTextDisclosure(row, control, deadline))) throw error;
      pressed.add(control);
      restore();
    }
  }
}
