// One element line of the page view while it is being chosen, before it is
// written out: which element, as what, and the words it will print.

import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmLineRole } from "./element";

export type WebLlmViewLine = {
  element: WebLlmEvidenceElement;
  role: WebLlmLineRole;
  /** What the line prints in quotes, W1 already applied; `undefined` for a line with no words. */
  words: string | undefined;
  /** Only on a line F4 made from a run of letterless fragments: the elements whose words it joined. */
  merged?: readonly WebLlmEvidenceElement[];
};
