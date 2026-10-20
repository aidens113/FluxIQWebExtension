// How the extension words a wait on the person in the shared activity headline
// (`ActivityHostWords` in `fluxiq/ui`, required by Core's pacer so no host
// inherits another's phrasing). The person answers a question in the FluxIQ
// panel beside the page, and finishes a check on the page itself; both
// sentences are the ones the extension has always shown.

import type { ActivityHostWords } from "fluxiq/ui";

export const EXTENSION_ACTIVITY_HOST_WORDS: ActivityHostWords = Object.freeze({
  answer: "Waiting for you: answer in the FluxIQ panel",
  check: "Waiting for you: finish the check on the page"
});
