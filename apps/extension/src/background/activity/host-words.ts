// How the extension words a wait on the person in the shared activity headline
// (`ActivityHostWords` in `fluxiq/ui`, required by Core's pacer so no host
// inherits another's phrasing), on the page's card and, after its "Waiting for
// you:", in the panel's work header, so each has to read true in both places.
//
// A question is in the FluxIQ panel. A check only a person can pass is finished on
// the page, and Continue is pressed afterwards. Core's pacer heads every wait it
// was told of as a question, a person-only check's too, so `answer` says where the
// question is rather than "answer in the panel", which on a check would point the
// wrong way; Core's sentence beside it says what to do.

import type { ActivityHostWords } from "fluxiq/ui";

export const EXTENSION_ACTIVITY_HOST_WORDS: ActivityHostWords = Object.freeze({
  answer: "Waiting for you: a question in the FluxIQ panel",
  check: "Waiting for you: finish the check on the page, then press Continue"
});
