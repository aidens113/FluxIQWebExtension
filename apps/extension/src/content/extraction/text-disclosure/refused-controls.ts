// Which collapsed control an `incomplete_text` refusal was raised over, keyed by
// the refusal itself, so a read asked to disclose text (`read-disclosing.ts`)
// presses exactly the control the check found, inside the field it read,
// rather than searching the row for one. A weak map rather than a property of
// the error, so no page element ever rides on a failure that is serialized.

/** The control each `incomplete_text` refusal was raised over (`text-disclosure.ts` writes it, `read-disclosing.ts` reads it). */
export const REFUSED_DISCLOSURE_CONTROLS = new WeakMap<object, Element>();
