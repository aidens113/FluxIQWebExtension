// Where the page stands against where a build began (t462): the web domain's
// answer to Core's `startState`, passive only.

export { webStartStateDifferences } from "./differences";
export { observeWebStartState } from "./observe";
export { webStartStateFromEvidence } from "./page-state";
export { webStartStateOf } from "./read-state";
export { WEB_START_STATE_SCHEMA_VERSION } from "./schema-version";
export type { WebStartState } from "./state";
