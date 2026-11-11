// Whether a line that says what the line before it says may fold into it
// (rule F3, and a joined F4 line folded the same way).
//
// A repeat is a second copy of words already printed -- a price drawn for the
// eye beside its screen-reader copy, a caption under its own link. **A message
// the last act raised is not a copy (t885, S1).** A booking widget whose Next
// was pressed with no time chosen drew the red error "Choose a time." straight
// after its grey note "Choose a time.", and F3 folded the error away, so
// neither the model nor the judge could see the press had raised a form error
// (`run-mwc6ut8u-52e3c1b3`, steps 149 and 151). So a line is kept when its
// element changed since the page's previous capture and the line before it did
// not: the page has just said it again, which is news. A line in another
// landmark or another dialog than the line before it is a different place
// saying it, and is kept too.

import type { WebLlmEvidenceElement } from "../../elements";

/** Whether `element`'s line, saying what `previous`'s line says, is a copy of it and may fold into it. */
export function webLlmRepeatFolds(previous: WebLlmEvidenceElement, element: WebLlmEvidenceElement): boolean {
  if (element.changed === true && previous.changed !== true) return false;
  return element.landmark === previous.landmark && element.dialog === previous.dialog;
}
