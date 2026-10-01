// The shape `stateRefs.stateDiff` carries for a web attempt, and what Core's
// `core.state_diff` option answers a model with.
//
// `.v3` (t223): what came and went is the page view's own lines, handle-free,
// as text -- never element objects. `.v2` listed `{tag, role, name, text, form}`
// objects for every element that appeared or left.

/** `web-state-diff.v3`. */
export const WEB_STATE_DIFF_SCHEMA_VERSION = "web-state-diff.v3" as const;
