// Barrel for what a page changes by itself, as one Flow's build has seen it (t496),
// and what a layer the page raised by itself shows on the page an act left (t499).
export { createWebLlmSelfChangingNames, type WebLlmSelfChangingNames } from "./names";
export { webLlmPageRaisedNames } from "./page-raised";
// The words a control shows as state, which its saved identity marks as a value (t1071, F1).
export { createWebLlmStateWords, type WebLlmStateWords, type WebLlmStateWordsMark } from "./state-words";
