// Barrel for the options that stand chosen on each page a build has looked at
// (`./memory.ts`, t1023), read from the view's typed state (`./page-choices.ts`),
// the ones a call found (`./found.ts`) as its draft statement says them
// (`./stated.ts`), and what its result says of those out of view (`./unshown.ts`).
export { createWebNodeStandingChoices, type WebNodeStandingChoices, type WebStandingChoice } from "./memory";
export { webPageChoiceLines, type WebPageChoiceLine } from "./page-choices";
export { webStandingChoicesFound } from "./found";
export { webStandingChoicesStated } from "./stated";
export { webStandingChoicesUnshown } from "./unshown";
