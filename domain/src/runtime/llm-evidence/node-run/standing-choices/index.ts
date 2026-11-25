// Barrel for the options that stand chosen on each page a build has looked at
// (`./memory.ts`, t1023), read from the view's typed state (`./page-choices.ts`),
// the ones a call found (`./found.ts`) as its draft statement says them
// (`./stated.ts`), what its result says of those out of view (`./unshown.ts`),
// and what finds each one again on a later visit (`./at.ts`, t1030).
export { webStandingChoiceAt } from "./at";
export { createWebNodeStandingChoices, type WebNodeStandingChoices, type WebStandingChoice, type WebStandingChoiceFinder } from "./memory";
export { webPageChoiceLines, type WebPageChoiceLine } from "./page-choices";
export { webStandingChoicesFound } from "./found";
export { webStandingChoicesStated } from "./stated";
export { webStandingChoicesUnshown } from "./unshown";
