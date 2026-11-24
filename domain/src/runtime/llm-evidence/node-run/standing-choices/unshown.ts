// The options that stood chosen as a call found the page and that the page it
// left does not show chosen, as the call's result says them (t1023).
//
// A press states every option standing as it found the page on its draft
// statement (`chosen`, `../run.ts`), and Core keeps an option's words only when
// the call's own evidence shows them (`AS/runtime/flow-authoring/draft/control-words.ts`).
// One the page left shows chosen is on the page; one out of view -- a chooser
// closed, a panel scrolled away -- is said here, so the model reads it too:
// `t332 "Pickup"`.

import { webPageChoiceLines } from "./page-choices";
import type { WebLlmPageEvidence } from "../../sanitize";
import type { WebStandingChoice } from "./memory";

/** The lines `t<n> "<words>"` for the standing options `after` does not show chosen, or nothing when there are none. */
export function webStandingChoicesUnshown(stood: readonly WebStandingChoice[], after: WebLlmPageEvidence | undefined): string[] | undefined {
  const shown = new Set(after ? webPageChoiceLines(after).filter((line) => line.chosen).map((line) => `${line.handle}\u0000${line.words}`) : []);
  const unshown = stood.filter((option) => !shown.has(`${option.handle}\u0000${option.words}`)).map((option) => `${option.handle} ${JSON.stringify(option.words)}`);
  return unshown.length ? unshown : undefined;
}
