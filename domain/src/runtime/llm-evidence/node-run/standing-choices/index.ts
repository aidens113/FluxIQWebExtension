// Barrel for the options that stand chosen on each page a build has looked at
// (`./memory.ts`, t1023), read from the view's typed state (`./page-choices.ts`),
// and what a call's result says of those out of view (`./unshown.ts`).
export { createWebNodeStandingChoices, type WebNodeStandingChoices, type WebStandingChoice } from "./memory";
export { webPageChoiceLines, type WebPageChoiceLine } from "./page-choices";
export { webStandingChoicesUnshown } from "./unshown";
